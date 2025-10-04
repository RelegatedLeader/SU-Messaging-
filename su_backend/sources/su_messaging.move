module su_backend::su_messaging {
    use sui::object;
    use sui::tx_context;
    use sui::transfer;
    use sui::clock;
    use sui::event;
    use sui::bcs;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use std::vector;
    use std::string;
    use std::option;

    // User profile struct
    public struct User has key, store {
        id: object::UID,
        wallet: address,
        display_name: vector<u8>,
        encryption_key: vector<u8>, // Shared key hash (simplified placeholder)
        name_change_count: u64, // Track number of name changes for payment logic
    }

    // Admin capability for name updates
    public struct AdminCap has key, store {
        id: object::UID,
    }

    // Call record (minimal storage)
    public struct CallRecord has key, store {
        id: object::UID,
        caller: address,
        callee: address,
        timestamp: u64,
    }

    // Message struct with encryption
    public struct Message has key, store {
        id: object::UID,
        sender: address,
        recipient: address,
        group_id: option::Option<address>, // Optional group ID for group chats
        encrypted_content: vector<u8>, // Encrypted text/GIF/attachment
        timestamp: u64,
        is_read: bool,
        is_voice: bool,
        encrypted_voice: vector<u8>, // Encrypted voice data
        is_video: bool,
        encrypted_attachment: option::Option<vector<u8>>, // Encrypted attachment/GIF
    }

    // Group chat struct
    public struct Group has key, store {
        id: object::UID,
        name: vector<u8>,
        members: vector<address>,
    }

    // Event emitted when a message is created
    public struct MessageCreated has copy, drop {
        message_id: object::ID,
        sender: address,
        recipient: address,
        group_id: option::Option<address>,
        timestamp: u64,
    }

    // Event for call initiation
    public struct CallInitiated has copy, drop {
        caller: address,
        callee: address,
        timestamp: u64,
    }

    // Event for name updates
    public struct NameUpdated has copy, drop {
        user: address,
        new_name: vector<u8>,
    }

    // Register a new user with encryption key
    public entry fun register(ctx: &mut tx_context::TxContext) {
        let user = User {
            id: object::new(ctx),
            wallet: tx_context::sender(ctx),
            display_name: b"Anonymous",
            encryption_key: bcs::to_bytes(&tx_context::sender(ctx)), // Placeholder key
            name_change_count: 0, // Initialize name change count
        };
        let admin_cap = AdminCap {
            id: object::new(ctx),
        };
        transfer::transfer(user, tx_context::sender(ctx));
        transfer::transfer(admin_cap, tx_context::sender(ctx));
    }

    // Update display name with payment logic (free for first 3 changes, then requires payment)
    public entry fun update_name(
        user: &mut User,
        new_name: vector<u8>,
        payment: Coin<SUI>,
        ctx: &mut tx_context::TxContext
    ) {
        // Assert sender owns the user object
        assert!(tx_context::sender(ctx) == user.wallet, 0);

        // Check if this is a free change (first 3 changes) or requires payment
        if (user.name_change_count >= 3) {
            // After 3 free changes, require minimum payment of 0.001 SUI to specific address
            let payment_amount = coin::value(&payment);
            assert!(payment_amount >= 1000000, 1); // 0.001 SUI in MIST (1e6)

            // Transfer payment to the specified address
            transfer::public_transfer(payment, @0xd1b0ff621a6803c8f0cd8051359ce312ece62b485e010e32b58a99d5ec13201c);
        } else {
            // For free changes, just destroy the zero payment coin
            coin::destroy_zero(payment);
        };

        // Update the display name
        user.display_name = new_name;
        user.name_change_count = user.name_change_count + 1;

        event::emit(NameUpdated {
            user: user.wallet,
            new_name: user.display_name,
        });
    }

    // Send a secure message (text/GIF/attachment)
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
            group_id: option::none(),
            encrypted_content,
            timestamp: clock::timestamp_ms(clock),
            is_read: false,
            is_voice: false,
            encrypted_voice: vector::empty<u8>(),
            is_video: false,
            encrypted_attachment: option::none(),
        };
        event::emit(MessageCreated {
            message_id: object::id(&message),
            sender: tx_context::sender(ctx),
            recipient,
            group_id: option::none(),
            timestamp: message.timestamp,
        });
        transfer::share_object(message);
    }

    // Send a secure group message
    public entry fun send_group_message(
        group_id: address,
        encrypted_content: vector<u8>,
        clock: &clock::Clock,
        ctx: &mut tx_context::TxContext
    ) {
        let message = Message {
            id: object::new(ctx),
            sender: tx_context::sender(ctx),
            recipient: @0x0, // Placeholder for group
            group_id: option::some(group_id),
            encrypted_content,
            timestamp: clock::timestamp_ms(clock),
            is_read: false,
            is_voice: false,
            encrypted_voice: vector::empty<u8>(),
            is_video: false,
            encrypted_attachment: option::none(),
        };
        event::emit(MessageCreated {
            message_id: object::id(&message),
            sender: tx_context::sender(ctx),
            recipient: @0x0,
            group_id: option::some(group_id),
            timestamp: message.timestamp,
        });
        transfer::share_object(message);
    }

    // Send a secure voice message
    public entry fun send_voice_message(
        recipient: address,
        encrypted_voice: vector<u8>,
        clock: &clock::Clock,
        ctx: &mut tx_context::TxContext
    ) {
        let message = Message {
            id: object::new(ctx),
            sender: tx_context::sender(ctx),
            recipient,
            group_id: option::none(),
            encrypted_content: vector::empty<u8>(),
            timestamp: clock::timestamp_ms(clock),
            is_read: false,
            is_voice: true,
            encrypted_voice,
            is_video: false,
            encrypted_attachment: option::none(),
        };
        event::emit(MessageCreated {
            message_id: object::id(&message),
            sender: tx_context::sender(ctx),
            recipient,
            group_id: option::none(),
            timestamp: message.timestamp,
        });
        transfer::share_object(message);
    }

    // Initiate a secure video call (minimal record)
    public entry fun initiate_call(
        callee: address,
        clock: &clock::Clock,
        ctx: &mut tx_context::TxContext
    ) {
        let call_record = CallRecord {
            id: object::new(ctx),
            caller: tx_context::sender(ctx),
            callee,
            timestamp: clock::timestamp_ms(clock),
        };
        event::emit(CallInitiated {
            caller: tx_context::sender(ctx),
            callee,
            timestamp: call_record.timestamp,
        });
        transfer::share_object(call_record);
    }

    // Send a secure attachment/GIF
    public entry fun send_attachment(
        recipient: address,
        encrypted_attachment: vector<u8>,
        clock: &clock::Clock,
        ctx: &mut tx_context::TxContext
    ) {
        let message = Message {
            id: object::new(ctx),
            sender: tx_context::sender(ctx),
            recipient,
            group_id: option::none(),
            encrypted_content: vector::empty<u8>(),
            timestamp: clock::timestamp_ms(clock),
            is_read: false,
            is_voice: false,
            encrypted_voice: vector::empty<u8>(),
            is_video: false,
            encrypted_attachment: option::some(encrypted_attachment),
        };
        event::emit(MessageCreated {
            message_id: object::id(&message),
            sender: tx_context::sender(ctx),
            recipient,
            group_id: option::none(),
            timestamp: message.timestamp,
        });
        transfer::share_object(message);
    }

    // Create a new group
    public entry fun create_group(
        name: vector<u8>,
        members: vector<address>,
        ctx: &mut tx_context::TxContext
    ) {
        let group = Group {
            id: object::new(ctx),
            name,
            members,
        };
        transfer::share_object(group);
    }

    // Mark message as read
    public entry fun mark_read(message: &mut Message, ctx: &mut tx_context::TxContext) {
        assert!(tx_context::sender(ctx) == message.recipient || option::is_some(&message.group_id), 0);
        message.is_read = true;
    }

    // Get user's display name
    public fun get_display_name(user: &User): &vector<u8> {
        &user.display_name
    }

    // Get user's name change count
    public fun get_name_change_count(user: &User): u64 {
        user.name_change_count
    }

    // Get message details
    public fun get_message_details(message: &Message): (&address, &address, &option::Option<address>, &vector<u8>, u64, bool, &vector<u8>, bool, &option::Option<vector<u8>>) {
        (&message.sender, &message.recipient, &message.group_id, &message.encrypted_content, message.timestamp, message.is_voice, &message.encrypted_voice, message.is_video, &message.encrypted_attachment)
    }

    // Note: Encryption is handled client-side (e.g., AES-128 with CryptoJS). The contract stores encrypted data as vector<u8>.
    // Key exchange should use Diffie-Hellman in practice; currently, a placeholder key is used.
    // Metadata (addresses, timestamps) is public; use permissions (mark_read) for access control.
}