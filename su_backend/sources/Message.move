module su_backend::message {
    use sui::object;
    use sui::transfer;
    use sui::tx_context::TxContext;

    public struct Message has key, store {
        id: object::UID,
        sender: address,
        recipient: address,
        content: vector<u8>,
        timestamp: u64,
    }

    public entry fun send_message(sender: address, recipient: address, content: vector<u8>, ctx: &mut TxContext) {
        let message = Message {
            id: object::new(ctx),
            sender,
            recipient,
            content,
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        };
        // Emit event before transferring ownership
        emit_message_created(message.timestamp, sender, recipient, ctx);
        transfer::public_transfer(message, recipient); // Transfer to recipient
    }

    public entry fun get_message(message: &Message): (address, address, vector<u8>, u64) {
        (message.sender, message.recipient, message.content, message.timestamp)
    }

    // Internal function to emit event
    fun emit_message_created(id: u64, sender: address, recipient: address, _ctx: &mut TxContext) {
        let event = MessageCreated { id, sender, recipient };
        sui::event::emit(event);
    }

    public struct MessageCreated has copy, drop {
        id: u64, // Using timestamp as ID
        sender: address,
        recipient: address,
    }
}