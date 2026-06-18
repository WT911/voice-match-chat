import { useState, useRef, useCallback, useEffect } from "react";

interface UseWebRTCOptions {
  matchId: string | null;
  isInitiator: boolean;
  onSignal: (signalType: "offer" | "answer" | "ice_candidate", data: any) => void;
  onRemoteStream?: (stream: MediaStream) => void;
}

export function useWebRTC({
  matchId,
  isInitiator,
  onSignal,
  onRemoteStream,
}: UseWebRTCOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Cleanup
  useEffect(() => {
    return () => {
      endCall();
    };
  }, []);

  const startCall = useCallback(async () => {
    if (!matchId) return;
    setIsConnecting(true);

    try {
      // Get local audio
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);

      // Create peer connection
      const iceServers: RTCIceServer[] = [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ];
      // 从服务端配置读取 TURN 服务器
      try {
        const configRes = await fetch("/api/voice-match/webrtc-config");
        if (configRes.ok) {
          const config = await configRes.json();
          if (config.turnUrl) {
            iceServers.push({
              urls: config.turnUrl,
              username: config.turnUsername || "",
              credential: config.turnCredential || "",
            });
          }
        }
      } catch {}

      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;

      // Add local tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          onSignal("ice_candidate", { candidate: event.candidate.toJSON() });
        }
      };

      // Handle remote stream
      pc.ontrack = (event) => {
        const [remote] = event.streams;
        if (remote) {
          setRemoteStream(remote);
          onRemoteStream?.(remote);
        }
      };

      // Connection state
      pc.onconnectionstatechange = () => {
        setConnectionState(pc.connectionState);
        if (pc.connectionState === "connected") {
          setIsConnecting(false);
        }
      };

      // If initiator, create offer
      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        onSignal("offer", { sdp: pc.localDescription });
      }
    } catch (err) {
      console.error("WebRTC startCall error:", err);
      setIsConnecting(false);
    }
  }, [matchId, isInitiator, onSignal, onRemoteStream]);

  const handleSignal = useCallback(
    async (signalType: string, sdp?: any, candidate?: any) => {
      const pc = pcRef.current;
      if (!pc) return;

      try {
        if (signalType === "offer" && sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          onSignal("answer", { sdp: pc.localDescription });
        } else if (signalType === "answer" && sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        } else if (signalType === "ice_candidate" && candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error("WebRTC handleSignal error:", err);
      }
    },
    [onSignal]
  );

  const endCall = useCallback(() => {
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Close peer connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setConnectionState("closed");
    setIsConnecting(false);
  }, []);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  return {
    localStream,
    remoteStream,
    connectionState,
    isConnecting,
    isMuted,
    startCall,
    handleSignal,
    endCall,
    toggleMute,
  };
}
