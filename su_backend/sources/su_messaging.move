#[allow(duplicate_alias)]
module su_backend::su_messaging {
    use sui::object;
    use sui::tx_context;
    use sui::transfer;
    use sui::clock;

    /// User profile struct
    public struct User has key, store {
        id: object::UID,
        wallet: address,
        display_name: vector<u8>,
    }

    /// Message struct
    public struct Message has key, store {
        id: object::UID,
        sender: address,
        recipient: address,
        encrypted_content: vector<u8>,
        timestamp: u64,
    }

    /// Register a new user
    public entry fun register(display_name: vector<u8>, ctx: &mut tx_context::TxContext) {
        let user = User {
            id: object::new(ctx),
            wallet: tx_context::sender(ctx),
            display_name,
        };
        transfer::transfer(user, tx_context::sender(ctx));
    }

    /// Send a message
    public entry fun send_message(
        recipient: address,
        encrypted_content: vector<u8>,
        clock: &clock::Clock,
        ctx: &mut tx_context::TxContext
    ) {
        let message = Message {
            id: object::new(ctx),
            sender: tx_context::sender(ctx),
            recipient,
            encrypted_content,
            timestamp: clock::timestamp_ms(clock),
        };
        transfer::share_object(message);
    }

    /// Get user's display name
    public fun get_display_name(user: &User): &vector<u8> {
        &user.display_name
    }

    /// Get message details
    public fun get_message_details(message: &Message): (&address, &address, &vector<u8>, u64) {
        (&message.sender, &message.recipient, &message.encrypted_content, message.timestamp)
    }
}