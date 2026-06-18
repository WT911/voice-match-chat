/**
 * WebRTC 信令转发管理器
 */

import { matchQueue } from "./matching.js";
import { userStore } from "./user-store.js";
import type { WSClient } from "./types.js";

export class SignalingManager {
  /**
   * 转发信令消息到匹配对端
   */
  forwardSignal(
    matchId: string,
    fromUserId: string,
    signalType: "offer" | "answer" | "ice_candidate",
    sdp?: any,
    candidate?: any
  ): boolean {
    const peerId = matchQueue.getPeerId(matchId, fromUserId);
    if (!peerId) return false;

    const peerUser = userStore.getUser(peerId);
    if (!peerUser) return false;

    const peerWS = peerUser.wsClient;
    if (peerWS.readyState !== peerWS.OPEN) return false;

    const message = JSON.stringify({
      type: "voice_match:signal_forward",
      matchId,
      signalType,
      ...(sdp && { sdp }),
      ...(candidate && { candidate }),
    });

    peerWS.send(message);
    return true;
  }

  /**
   * 通知对端用户断开
   */
  notifyPeerDisconnected(matchId: string, disconnectedUserId: string, reason: string): void {
    const peerId = matchQueue.getPeerId(matchId, disconnectedUserId);
    if (!peerId) return;

    const peerUser = userStore.getUser(peerId);
    if (!peerUser) return;

    const peerWS = peerUser.wsClient;
    if (peerWS.readyState === peerWS.OPEN) {
      peerWS.send(
        JSON.stringify({
          type: "voice_match:peer_disconnected",
          matchId,
          reason,
        })
      );
    }
  }

  /**
   * 向单个用户发送消息
   */
  sendToUser(userId: string, message: object): boolean {
    const user = userStore.getUser(userId);
    if (!user) return false;

    const ws = user.wsClient;
    if (ws.readyState !== ws.OPEN) return false;

    ws.send(JSON.stringify(message));
    return true;
  }
}

export const signalingManager = new SignalingManager();
