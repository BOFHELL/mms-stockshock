import { readFileSync } from "fs";
import http from "http";
import https from "https";
import { Socket } from "net";
import { Logger } from "winston";
import WebSocket from "ws";
import { Item } from "../models/api/item";
import { Notifier } from "../models/notifier";
import { StoreConfiguration } from "../models/stores/config-model";
import { Store } from "../models/stores/store";
import { ProductHelper } from "../utils/product-helper";
import { noop, shuffle } from "../utils/utils";

export class WebSocketNotifier implements Notifier {
    private heartBeatPing: NodeJS.Timeout | undefined;
    private readonly logger: Logger;
    private readonly store: Store;
    private readonly productHelper = new ProductHelper();
    private readonly wss: WebSocket.Server | null;

    constructor(storeConfig: StoreConfiguration, logger: Logger, store: Store) {
        this.logger = logger;
        this.store = store;
        this.wss = this.setupWebSocketServer(storeConfig);
    }

    async notifyAdmin(): Promise<void> {
        return noop();
    }

    async notifyRateLimit(): Promise<void> {
        return noop();
    }

    async notifyCookies(): Promise<void> {
        return noop();
    }

    async notifyStock(item: Item): Promise<string | undefined> {
        const fullAlert = this.productHelper.isProductBuyable(item);
        if (fullAlert) {
            await this.notifyWebSocketClients(item, true);
        } else if (!this.productHelper.canProductBeAddedToBasket(item)) {
            await this.notifyWebSocketClients(item, false);
        }
        return undefined;
    }

    async notifyPriceChange(): Promise<void> {
        return noop();
    }

    shutdown(): void {
        this.closeWebSocketServer();
    }

    private setupWebSocketServer(storeConfig: StoreConfiguration): WebSocket.Server | null {
        if (!storeConfig.use_websocket) {
            return null;
        }

        let server: http.Server | https.Server;
        if (storeConfig.websocket_https && storeConfig.websocket_cert_path && storeConfig.websocket_key_path) {
            server = https.createServer({
                cert: readFileSync(storeConfig.websocket_cert_path),
                key: readFileSync(storeConfig.websocket_key_path),
            });
        } else {
            server = http.createServer();
        }
        const wss = new WebSocket.Server({ noServer: true });

        server.on("upgrade", (request, socket: Socket, head) => {
            const password = request.headers["sec-websocket-protocol"];
            if (!password || !storeConfig.websocket_passwords?.includes(password)) {
                this.logger.info(`😵‍💫 WebSocket connection from client from ${socket?.remoteAddress} was denied!`);
                socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
                socket.destroy();
                return;
            }
            this.logger.info(
                `👌 WebSocket client from ${socket?.remoteAddress} connected successfully with ${
                    storeConfig.log_passwords ? password : "***"
                }`
            );
            wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
        });

        server.listen(storeConfig.websocket_port ?? 8080);

        this.heartBeatPing = setInterval(async () => {
            for (const client of wss?.clients) {
                if (client.readyState === WebSocket.OPEN) {
                    client.ping();
                    this.logger.info("💖 Sending heartbeat ping to client");
                }
            }
        }, 30000);
        return wss;
    }

    private async notifyWebSocketClients(item: Item, direct: boolean) {
        if (this.wss) {
            for (const client of shuffle(Array.from(this.wss.clients))) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(
                        JSON.stringify({
                            direct,
                            title: item.product.title,
                            id: item.product.id,
                            price: item?.price?.price || 0,
                        }),
                        async (e) => {
                            if (e) {
                                this.logger.info("😵‍💫 Error sending stock ping, %O", e);
                            }
                        }
                    );
                }

                this.logger.info(
                    `🏓 Sending stock ping to client (${(client as WebSocketExtended)._socket.remoteAddress}) with ready state ${
                        client.readyState
                    }`
                );
                this.store.getSleepTime();
            }
        }
    }

    private closeWebSocketServer() {
        if (this.heartBeatPing) {
            clearInterval(this.heartBeatPing);
        }
        this.wss?.close();
    }
}

interface WebSocketExtended extends WebSocket {
    _socket: Socket;
}
