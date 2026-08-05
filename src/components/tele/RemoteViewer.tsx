import React, { useEffect, useRef, useState, useCallback } from "react";
import { Button, Input, Tag, Tooltip, Space, Badge, Typography } from "antd";
import {
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  MessageSquare,
  Link2,
  Users,
  Send,
} from "lucide-react";

const { Text } = Typography;

type SessionStatus =
  "disconnected" | "connecting" | "connected" | "reconnecting";

interface RemoteCursor {
  userId: string;
  x: number;
  y: number;
  color: string;
  name: string;
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: string;
}

export interface RemoteViewerProps {
  sessionId: string;
  userId: string;
  userName: string;
  apiUrl?: string;
  onSessionStatusChange?: (status: SessionStatus) => void;
}

const API_BASE = "/api";

export const RemoteViewer: React.FC<RemoteViewerProps> = ({
  sessionId,
  userId,
  userName,
  apiUrl = API_BASE,
  onSessionStatusChange,
}) => {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const cursorContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);
  const lastChatTsRef = useRef("");

  const [status, setStatus] = useState<SessionStatus>("disconnected");
  const [cursors, setCursors] = useState<RemoteCursor[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  const updateStatus = useCallback(
    (s: SessionStatus) => {
      setStatus(s);
      onSessionStatusChange?.(s);
    },
    [onSessionStatusChange],
  );

  const api = (path: string, options?: RequestInit) =>
    fetch(`${apiUrl}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });

  // Poll for signals
  const pollSignals = useCallback(async () => {
    try {
      const res = await api(`/tele/signal/${sessionId}?peer=${userId}`);
      if (!res.ok) return;
      const signals: Array<{
        type: string;
        from: string;
        to: string;
        payload: unknown;
      }> = await res.json();
      for (const sig of signals) {
        const pc = pcRef.current;
        if (!pc) continue;
        try {
          if (sig.type === "offer") {
            await pc.setRemoteDescription(
              new RTCSessionDescription(
                sig.payload as RTCSessionDescriptionInit,
              ),
            );
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await api("/tele/signal", {
              method: "POST",
              body: JSON.stringify({
                type: "answer",
                from: userId,
                to: sig.from,
                sessionId,
                payload: pc.localDescription,
              }),
            });
          } else if (sig.type === "answer") {
            await pc.setRemoteDescription(
              new RTCSessionDescription(
                sig.payload as RTCSessionDescriptionInit,
              ),
            );
          } else if (sig.type === "ice-candidate") {
            await pc.addIceCandidate(
              new RTCIceCandidate(sig.payload as RTCIceCandidateInit),
            );
          }
        } catch (err) {
          console.warn("[RemoteViewer] signal handling failed", err);
        }
      }
    } catch (err) {
      console.warn("[RemoteViewer] pollSignals failed", err);
    }
  }, [sessionId, userId, apiUrl]);

  // Poll for chat messages
  const pollChat = useCallback(async () => {
    try {
      const qs = lastChatTsRef.current
        ? `?since=${encodeURIComponent(lastChatTsRef.current)}`
        : "";
      const res = await api(`/tele/chat/${sessionId}${qs}`);
      if (!res.ok) return;
      const msgs: ChatMessage[] = await res.json();
      if (msgs.length > 0) {
        const filtered = msgs.filter((m) => m.userId !== userId);
        const lastMsg = filtered.at(-1);
        if (lastMsg) {
          setMessages((prev) => [...prev, ...filtered]);
          lastChatTsRef.current = lastMsg.timestamp;
        }
      }
    } catch (err) {
      console.warn("[RemoteViewer] pollChat failed", err);
    }
  }, [sessionId, userId, apiUrl]);

  // Poll for cursors
  const pollCursors = useCallback(async () => {
    try {
      const res = await api(`/tele/cursor/${sessionId}`);
      if (!res.ok) return;
      const data: RemoteCursor[] = await res.json();
      setCursors(data.filter((c) => c.userId !== userId));
    } catch (err) {
      console.warn("[RemoteViewer] pollCursors failed", err);
    }
  }, [sessionId, userId, apiUrl]);

  // Send cursor position
  const sendCursor = useCallback(
    (x: number, y: number) => {
      api("/tele/cursor", {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          userId,
          userName,
          x,
          y,
          color: "#3b82f6",
        }),
      }).catch(() => {});
    },
    [sessionId, userId, userName, apiUrl],
  );

  useEffect(() => {
    updateStatus("connecting");

    const init = async () => {
      try {
        await api(`/tele/session/${sessionId}`);
        updateStatus("connected");
      } catch {
        updateStatus("disconnected");
      }
    };
    init();

    pollRef.current = window.setInterval(() => {
      pollSignals();
      pollChat();
      pollCursors();
    }, 1000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pcRef.current?.close();
    };
  }, [sessionId, userId]);

  const startPeerConnection = async () => {
    if (pcRef.current) return;
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        api("/tele/signal", {
          method: "POST",
          body: JSON.stringify({
            type: "ice-candidate",
            from: userId,
            to: "",
            sessionId,
            payload: e.candidate.toJSON(),
          }),
        }).catch(() => {});
      }
    };

    pc.ontrack = (e) => {
      if (remoteVideoRef.current && e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
        setPeerConnected(true);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setPeerConnected(true);
      if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed"
      ) {
        setPeerConnected(false);
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await api("/tele/signal", {
        method: "POST",
        body: JSON.stringify({
          type: "offer",
          from: userId,
          to: "",
          sessionId,
          payload: pc.localDescription,
        }),
      });
    } catch (err) {
      console.warn("[RemoteViewer] startPeerConnection failed", err);
    }
  };

  useEffect(() => {
    if (status === "connected") {
      startPeerConnection();
    }
  }, [status]);

  const toggleAudio = async () => {
    if (audioEnabled) {
      pcRef.current?.getSenders().forEach((s) => {
        if (s.track?.kind === "audio") pcRef.current?.removeTrack(s);
      });
      setAudioEnabled(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream
        .getAudioTracks()
        .forEach((t) => pcRef.current?.addTrack(t, stream));
      setAudioEnabled(true);
    } catch (err) {
      console.warn("[RemoteViewer] toggleAudio failed", err);
    }
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      pcRef.current?.getSenders().forEach((s) => {
        if (s.track?.kind === "video") pcRef.current?.removeTrack(s);
      });
      setScreenSharing(false);
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      stream.getVideoTracks().forEach((t) => {
        pcRef.current?.addTrack(t, stream);
        t.onended = () => setScreenSharing(false);
      });
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setScreenSharing(true);
    } catch (err) {
      console.warn("[RemoteViewer] toggleScreenShare failed", err);
    }
  };

  const handleCursorMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cursorContainerRef.current) return;
      const rect = cursorContainerRef.current.getBoundingClientRect();
      sendCursor(e.clientX - rect.left, e.clientY - rect.top);
    },
    [sendCursor],
  );

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    api("/tele/chat", {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        userId,
        userName,
        text: chatInput.trim(),
      }),
    })
      .then(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: "",
            userId,
            userName,
            text: chatInput.trim(),
            timestamp: new Date().toISOString(),
          },
        ]);
        setChatInput("");
      })
      .catch(() => {});
  };

  const generateInviteLink = () => {
    const base = window.location.origin;
    const link = `${base}/tele/conference?session=${sessionId}`;
    setInviteLink(link);
    navigator.clipboard.writeText(link).catch(() => {});
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const statusBadge = (() => {
    switch (status) {
      case "connected":
        return <Badge status="success" text="Connected" />;
      case "connecting":
      case "reconnecting":
        return <Badge status="processing" text="Reconnecting..." />;
      default:
        return <Badge status="error" text="Disconnected" />;
    }
  })();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 16,
        background: "#0f172a",
        color: "#e2e8f0",
        borderRadius: 8,
        height: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 4px",
        }}
      >
        <Space size={12}>
          <Text style={{ color: "#e2e8f0", fontWeight: 700 }}>
            Tele-Conference
          </Text>
          {statusBadge}
          {peerConnected && (
            <Tag color="green" style={{ margin: 0 }}>
              Peer Online
            </Tag>
          )}
        </Space>
        <Space size={4}>
          <Tooltip title={showChat ? "Hide Chat" : "Show Chat"}>
            <Button
              size="small"
              type="text"
              icon={<MessageSquare size={14} />}
              onClick={() => setShowChat(!showChat)}
              style={{ color: "#94a3b8" }}
            />
          </Tooltip>
          <Tooltip title="复制邀请链接">
            <Button
              size="small"
              type="text"
              icon={<Link2 size={14} />}
              onClick={generateInviteLink}
              style={{ color: "#94a3b8" }}
            />
          </Tooltip>
        </Space>
      </div>

      {inviteLink && (
        <div
          style={{
            padding: "4px 8px",
            background: "#1e293b",
            borderRadius: 4,
            fontSize: 12,
            color: "#94a3b8",
            wordBreak: "break-all",
          }}
        >
          Invite: {inviteLink}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0 }}>
        <div
          style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}
        >
          <div
            ref={cursorContainerRef}
            onMouseMove={handleCursorMove}
            style={{
              position: "relative",
              flex: 1,
              background: "#1e293b",
              borderRadius: 4,
              overflow: "hidden",
              minHeight: 200,
            }}
          >
            {screenSharing ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "#64748b",
                  fontSize: 13,
                }}
              >
                {peerConnected
                  ? "Remote Screen"
                  : "Waiting for peer to share screen..."}
              </div>
            )}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{ display: "none" }}
            />
            {cursors.map((c) => (
              <div
                key={c.userId}
                style={{
                  position: "absolute",
                  left: c.x,
                  top: c.y,
                  pointerEvents: "none",
                  transform: "translate(-2px, -2px)",
                  zIndex: 1000,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M1 1L5 11L6.5 6.5L11 5L1 1Z"
                    fill={c.color}
                    stroke="white"
                    strokeWidth="0.5"
                  />
                </svg>
                <span
                  style={{
                    marginLeft: 4,
                    padding: "1px 4px",
                    background: c.color,
                    color: "white",
                    fontSize: 10,
                    borderRadius: 3,
                    whiteSpace: "nowrap",
                    fontWeight: 600,
                  }}
                >
                  {c.name}
                </span>
              </div>
            ))}
          </div>

          <Space size={4} style={{ justifyContent: "center" }}>
            <Tooltip title={audioEnabled ? "Mute Audio" : "Unmute Audio"}>
              <Button
                size="small"
                type={audioEnabled ? "primary" : "default"}
                icon={audioEnabled ? <Mic size={14} /> : <MicOff size={14} />}
                onClick={toggleAudio}
              />
            </Tooltip>
            <Tooltip title={screenSharing ? "Stop Sharing" : "Share Screen"}>
              <Button
                size="small"
                type={screenSharing ? "primary" : "default"}
                icon={
                  screenSharing ? (
                    <MonitorOff size={14} />
                  ) : (
                    <Monitor size={14} />
                  )
                }
                onClick={toggleScreenShare}
              />
            </Tooltip>
            <Tag icon={<Users size={12} />} style={{ margin: 0 }}>
              {peerConnected ? "2 participants" : "1 participant"}
            </Tag>
          </Space>
        </div>

        {showChat && (
          <div
            style={{
              width: 240,
              display: "flex",
              flexDirection: "column",
              background: "#1e293b",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "6px 8px",
                borderBottom: "1px solid #334155",
                fontSize: 12,
                fontWeight: 600,
                color: "#cbd5e1",
              }}
            >
              <MessageSquare
                size={12}
                style={{ marginRight: 4, verticalAlign: "middle" }}
              />
              Chat
            </div>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 8,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {messages.map((msg, i) => (
                <div
                  key={msg.id || i}
                  style={{ fontSize: 12, lineHeight: 1.4 }}
                >
                  <Text
                    style={{ color: "#60a5fa", fontWeight: 600, fontSize: 11 }}
                  >
                    {msg.userName}:{" "}
                  </Text>
                  <Text style={{ color: "#cbd5e1", fontSize: 11 }}>
                    {msg.text}
                  </Text>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: "flex", borderTop: "1px solid #334155" }}>
              <Input
                size="small"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onPressEnter={sendChatMessage}
                placeholder="输入消息..."
                style={{
                  flex: 1,
                  border: "none",
                  background: "#0f172a",
                  color: "#e2e8f0",
                  fontSize: 12,
                }}
                variant="borderless"
              />
              <Button
                size="small"
                type="text"
                icon={<Send size={12} />}
                onClick={sendChatMessage}
                style={{ color: "#60a5fa" }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RemoteViewer;
