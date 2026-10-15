import { LunarAction, ModelType } from '../types/simulation';

type MessageHandler = (data: any) => void;

class WebSocketClient {
  private socket: WebSocket | null = null;
  private url: string = 'ws://localhost:8765';
  private handlers: Set<MessageHandler> = new Set();
  private isConnecting: boolean = false;
  private reconnectTimer: number | null = null;

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isConnecting = true;
    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        this.isConnecting = false;
        this.notifyHandlers({ type: 'connection_status', connected: true });
        this.sendCommand({ cmd: 'get_training_curve' });
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.notifyHandlers(data);
        } catch (e) {
          console.error('Failed to parse WS message:', e);
        }
      };

      this.socket.onclose = () => {
        this.isConnecting = false;
        this.notifyHandlers({ type: 'connection_status', connected: false });
        this.scheduleReconnect();
      };

      this.socket.onerror = () => {
        this.isConnecting = false;
        this.socket?.close();
      };
    } catch (e) {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
  }

  private notifyHandlers(data: any) {
    this.handlers.forEach((h) => h(data));
  }

  subscribe(handler: MessageHandler) {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  sendCommand(cmdObj: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(cmdObj));
    }
  }

  reset() {
    this.sendCommand({ cmd: 'reset' });
  }

  pause() {
    this.sendCommand({ cmd: 'pause' });
  }

  resume() {
    this.sendCommand({ cmd: 'resume' });
  }

  setModel(model: ModelType) {
    this.sendCommand({ cmd: 'set_model', model });
  }

  setSpeed(speed: number) {
    this.sendCommand({ cmd: 'set_speed', speed });
  }

  setMode(mode: 'ai' | 'random') {
    this.sendCommand({ cmd: 'set_mode', mode });
  }
}

export const wsService = new WebSocketClient();
