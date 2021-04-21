export interface Item {
    product: {
        id: string;
        title: string;
        url: string;
        onlineStatus: boolean;
        titleImageId: string;
    };
    price: {
        price: number;
        currency: string;
    };
    availability: {
        delivery: {
            availabilityType: "IN_WAREHOUSE" | "NONE";
            quantity: number;
            earliest: Date | null;
            latest: Date | null;
        };
        pickup?: unknown;
    };
}
