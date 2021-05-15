export interface ConfigModel {
    saturn: StoreConfiguration;
    mmde: StoreConfiguration;
    mmat: StoreConfiguration;
}

export interface StoreConfiguration {
    email: string;
    password: string;
    categories?: string[];
    category_regex: string;
    ignore_sleep?: boolean;
    cookies?: number;
    webhook_url?: string;
    stock_webhook_url?: string;
    cookie_webhook_url?: string;
    admin_webhook_url?: string;
    webhook_role_ping?: string;
    stock_webhook_role_ping?: string;
    cookie_webhook_role_ping?: string;
    admin_webhook_role_ping?: string;
    proxy_url?: string;
    proxy_username?: string;
    proxy_password?: string;
    proxy_urls?: string[];
    start_url?: string;
    dynamo_db_region?: string;
    dynamo_db_table_name?: string;
    dynamo_db_access_key?: string;
    dynamo_db_secret_access_key?: string;
}
