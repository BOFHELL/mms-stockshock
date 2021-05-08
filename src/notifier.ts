import { IncomingWebhook } from "@slack/webhook";
import { Item } from "./models/api/item";
import { ProductHelper } from "./product-helper";
import { StoreConfiguration } from "./models/stores/config-model";
import { Store } from "./models/stores/store";
import { Product } from "./models/api/product";

export class Notifier {
    private stockWebhook: IncomingWebhook | undefined;
    private cookieWebhook: IncomingWebhook | undefined;
    private adminWebhook: IncomingWebhook | undefined;
    private stockWebhookRolePing: string | undefined;
    private cookieWebhookRolePing: string | undefined;
    private adminWebhookRolePing: string | undefined;
    private store: Store;
    private productHelper = new ProductHelper();

    constructor(store: Store, storeConfig: StoreConfiguration) {
        this.store = store;
        if (storeConfig?.stock_webhook_url || storeConfig?.webhook_url) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.stockWebhook = new IncomingWebhook((storeConfig?.stock_webhook_url || storeConfig?.webhook_url)!);
        }
        if (storeConfig?.stock_webhook_role_ping || storeConfig?.webhook_role_ping) {
            this.stockWebhookRolePing = storeConfig?.stock_webhook_role_ping || storeConfig?.webhook_role_ping;
        }

        if (storeConfig?.cookie_webhook_url || storeConfig?.webhook_url) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.cookieWebhook = new IncomingWebhook((storeConfig?.cookie_webhook_url || storeConfig?.webhook_url)!);
        }
        if (storeConfig?.cookie_webhook_role_ping || storeConfig?.webhook_role_ping) {
            this.cookieWebhookRolePing = storeConfig?.cookie_webhook_role_ping || storeConfig?.webhook_role_ping;
        }

        if (storeConfig?.admin_webhook_url || storeConfig?.webhook_url) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.adminWebhook = new IncomingWebhook((storeConfig?.admin_webhook_url || storeConfig?.webhook_url)!);
        }
        if (storeConfig?.admin_webhook_role_ping || storeConfig?.webhook_role_ping) {
            this.adminWebhookRolePing = storeConfig?.admin_webhook_role_ping || storeConfig?.webhook_role_ping;
        }
    }

    async notifyAdmin(message: string): Promise<void> {
        if (this.adminWebhook) {
            const decoratedMessage = this.decorateMessageWithRoles(message, this.adminWebhookRolePing);
            try {
                await this.adminWebhook.send({
                    text: decoratedMessage,
                    username: `Bender 🤖`,
                });
            } catch {
                // Ignore
            }
        }
    }

    async notifyRateLimit(seconds: number): Promise<void> {
        if (this.adminWebhook && seconds > 300) {
            const message = this.decorateMessageWithRoles(
                `💤 [${this.store.getName()}] Too many requests, we need to pause ${(seconds / 60).toFixed(2)} minutes... 😴`,
                this.adminWebhookRolePing
            );
            try {
                await this.adminWebhook.send({
                    text: message,
                    username: `Stock Shock 💤`,
                });
            } catch {
                // Ignore
            }
        }
    }

    async notifyCookies(product: Product, cookies: string[]): Promise<void> {
        const message = this.decorateMessageWithRoles(
            `🍪 ${cookies.length} cart cookies were made for **${product?.id}**, **${
                product?.title
            }** for ${this.store.getName()}:\n\`${cookies.map((cookie) => `${this.store.baseUrl}?cookie=${cookie}`).join("\n")}\`\n`,
            this.cookieWebhookRolePing
        );
        if (this.cookieWebhook) {
            try {
                await this.cookieWebhook.send({
                    text: message,
                    username: "Cookie Monster 🍪 (light)",
                });
            } catch {
                // Ignore
            }
        }
    }

    async notifyStock(item: Item): Promise<string> {
        let message;
        const fullAlert = this.productHelper.isProductBuyable(item);
        if (fullAlert) {
            message = this.decorateMessageWithRoles(
                `🟢 Item **available**: ${item?.product?.title} for ${item?.price?.price} ${item?.price?.currency}! Go check it out: ${
                    this.store.baseUrl
                }${this.getProductURL(item)}?magician=${item?.product?.id}`,
                this.stockWebhookRolePing
            );
        } else if (this.productHelper.canProductBeAddedToCart(item)) {
            message = this.decorateMessageWithRoles(
                `🛒 Item **can be added to cart**: ${item?.product?.title} for ${item?.price?.price} ${
                    item?.price?.currency
                }! Go check it out: ${this.store.baseUrl}${this.getProductURL(item)}?magician=${item?.product?.id}`,
                this.stockWebhookRolePing
            );
        } else {
            message = this.decorateMessageWithRoles(
                `🟡 Item for **cart parker**: ${item?.product?.title} for ${item?.price?.price} ${
                    item?.price?.currency
                }! Go check it out: ${this.store.baseUrl}${this.getProductURL(item)}`,
                this.stockWebhookRolePing
            );
        }
        if (this.stockWebhook) {
            try {
                await this.stockWebhook.send({
                    text: message,
                    username: `Stock Shock ${fullAlert ? "🧚" : "⚡️"}`,
                    attachments: [
                        {
                            title_link: `${this.store.baseUrl}${item.product.url}`,
                            image_url: `https://assets.mmsrg.com/isr/166325/c1/-/${item.product.titleImageId}/mobile_200_200.png`,
                        },
                    ],
                });
            } catch {
                // Ignore
            }
        }
        if (fullAlert) {
            this.beep();
            setTimeout(() => this.beep(), 250);
            setTimeout(() => this.beep(), 500);
        }
        return message;
    }

    private beep() {
        process.stdout.write("\x07");
    }

    private decorateMessageWithRoles(message: string, webhookRolePing: string | undefined) {
        if (!webhookRolePing) {
            return message;
        }

        return `${message} <@&${webhookRolePing}>`;
    }

    private getProductURL(item: Item) {
        return item?.product?.url || `/de/product/-${item.product.id}.html`;
    }
}
