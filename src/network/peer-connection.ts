import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { Player } from '../engine/types';

export type NetworkRole = 'host' | 'client' | 'none';

export interface NetworkMessage {
  type: 'MOVE' | 'RESTART' | 'UNDO_REQUEST' | 'UNDO_ACCEPT' | 'CHAT' | 'PING' | 'PONG';
  payload?: any;
}

export interface NetworkState {
  connected: boolean;
  role: NetworkRole;
  roomCode: string | null;
  remotePlayerName: string;
  pingMs: number;
}

export class PeerNetwork {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  public state: NetworkState = {
    connected: false,
    role: 'none',
    roomCode: null,
    remotePlayerName: 'Opponent',
    pingMs: 0,
  };

  private onMessageCallback?: (msg: NetworkMessage) => void;
  private onStatusChangeCallback?: (state: NetworkState) => void;
  private pingIntervalId?: number;
  private lastPingSentTime: number = 0;

  constructor(
    onMessage?: (msg: NetworkMessage) => void,
    onStatusChange?: (state: NetworkState) => void
  ) {
    this.onMessageCallback = onMessage;
    this.onStatusChangeCallback = onStatusChange;
  }

  private notifyStatus(): void {
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback({ ...this.state });
    }
  }

  public static generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Host an online game with a room code.
   */
  public async hostGame(customCode?: string): Promise<string> {
    this.disconnect();

    const roomCode = customCode || PeerNetwork.generateRoomCode();
    const peerId = `fivexo-v1-${roomCode.toUpperCase()}`;

    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer(peerId, {
          debug: 1,
        });

        this.peer.on('open', () => {
          this.state.role = 'host';
          this.state.roomCode = roomCode.toUpperCase();
          this.notifyStatus();
          resolve(roomCode.toUpperCase());
        });

        this.peer.on('connection', (connection) => {
          this.setupConnection(connection);
        });

        this.peer.on('error', (err) => {
          console.error('[PeerNetwork] Peer error:', err);
          if (err.type === 'unavailable-id') {
            this.hostGame().then(resolve).catch(reject);
          } else {
            reject(err);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Join an online game hosted by another player.
   */
  public async joinGame(roomCode: string): Promise<void> {
    this.disconnect();
    const cleanCode = roomCode.trim().toUpperCase();
    const targetPeerId = `fivexo-v1-${cleanCode}`;

    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer({
          debug: 1,
        });

        this.peer.on('open', () => {
          this.state.role = 'client';
          this.state.roomCode = cleanCode;

          const connection = this.peer!.connect(targetPeerId, {
            reliable: true,
          });

          connection.on('open', () => {
            this.setupConnection(connection);
            resolve();
          });

          connection.on('error', (err) => {
            console.error('[PeerNetwork] Connection error:', err);
            reject(err);
          });
        });

        this.peer.on('error', (err) => {
          console.error('[PeerNetwork] Peer error:', err);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private setupConnection(connection: DataConnection): void {
    this.conn = connection;
    this.state.connected = true;
    this.notifyStatus();

    this.conn.on('data', (data: any) => {
      const msg = data as NetworkMessage;
      if (msg.type === 'PING') {
        this.send({ type: 'PONG' });
        return;
      }
      if (msg.type === 'PONG') {
        this.state.pingMs = Math.max(1, Math.round(Date.now() - this.lastPingSentTime));
        this.notifyStatus();
        return;
      }

      if (this.onMessageCallback) {
        this.onMessageCallback(msg);
      }
    });

    this.conn.on('close', () => {
      this.state.connected = false;
      this.notifyStatus();
    });

    this.startPing();
  }

  public send(msg: NetworkMessage): void {
    if (this.conn && this.conn.open) {
      this.conn.send(msg);
    }
  }

  public sendMove(x: number, y: number, player: Player): void {
    this.send({
      type: 'MOVE',
      payload: { x, y, player },
    });
  }

  private startPing(): void {
    if (this.pingIntervalId) clearInterval(this.pingIntervalId);
    this.pingIntervalId = window.setInterval(() => {
      if (this.conn && this.conn.open) {
        this.lastPingSentTime = Date.now();
        this.send({ type: 'PING' });
      }
    }, 4000);
  }

  public disconnect(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = undefined;
    }
    if (this.conn) {
      this.conn.close();
      this.conn = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.state = {
      connected: false,
      role: 'none',
      roomCode: null,
      remotePlayerName: 'Opponent',
      pingMs: 0,
    };
    this.notifyStatus();
  }
}
