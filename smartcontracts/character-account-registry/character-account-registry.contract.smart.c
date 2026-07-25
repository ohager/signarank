#program name CharAcctReg
#program description Signarank Character-Account Registry (singleton)
#program activationAmount 40000000
#pragma optimizationLevel 3
#pragma verboseAssembly false
#pragma maxAuxVars 3
#pragma version 2.3.0

// Method codes
#define M_SET_CHARACTER_HASH    1
#define M_REGISTER_CHARACTER    2
#define M_UNREGISTER_CHARACTER  3

// Trusted-hash slot (k1, k2). Uses (0, 0); chain-issued account IDs are
// large numbers and never collide with this fixed marker.
#define K_TRUSTED_HASH_K1 0
#define K_TRUSTED_HASH_K2 0

// Per-creator character counter lives at (creatorAccount, K_COUNTER_K2).
// K_COUNTER_K2 = 0 is reserved and never collides with a real characterId,
// since chain-issued contract IDs are never 0 — mirrors the (0, 0) reservation
// used for the trusted-hash slot above.
#define K_COUNTER_K2 0
#define MAX_CHARACTERS_PER_ACCOUNT 5

long ZERO;
const ZERO = 0;

struct TX {
    long txId;
    long sender;
    long message[4];
} currentTx;
long messageBuffer[4];
void main() {
    while ((currentTx.txId = getNextTx()) != ZERO) {
        currentTx.sender = getSender(currentTx.txId);
        readMessage(currentTx.txId, 0, currentTx.message);

        if (currentTx.sender == getCreator()) {
            switch (currentTx.message[0]) {
                case M_SET_CHARACTER_HASH:
                    setMapValue(K_TRUSTED_HASH_K1, K_TRUSTED_HASH_K2, currentTx.message[1]);
                break;
            }
        }
        else if (isSenderCharacter()) {
            switch (currentTx.message[0]) {
                case M_REGISTER_CHARACTER:
                    registerCharacter();
                break;
                case M_UNREGISTER_CHARACTER:
                    unregisterCharacter();
                break;
            }
        }
    }
}

void catch() {
    messageBuffer[] = "SignaRank: char reg exception";
    sendMessage(messageBuffer, getCreator());
    sendBalance(getCreator());
}


void registerCharacter() {
    long creator = getCreatorOf(currentTx.sender);
    // Index entry: (creatorAccount, characterId) -> codehash. Value carries
    // the version (codehash at registration time) so readers can distinguish
    // between contract revisions.
    if (getMapValue(creator, currentTx.sender) != ZERO) {
        // already registered — refresh the codehash, the slot is not reconsumed
        setMapValue(creator, currentTx.sender, getCodeHashOf(currentTx.sender));
        return;
    }
    long count = getMapValue(creator, K_COUNTER_K2);
    if (count < MAX_CHARACTERS_PER_ACCOUNT) {
        setMapValue(creator, K_COUNTER_K2, count + 1);
        setMapValue(creator, currentTx.sender, getCodeHashOf(currentTx.sender));
    }
}

void unregisterCharacter() {
    long creator = getCreatorOf(currentTx.sender);
    if (getMapValue(creator, currentTx.sender) == ZERO) { return; }
    long count = getMapValue(creator, K_COUNTER_K2);
    if (count > ZERO) { setMapValue(creator, K_COUNTER_K2, count - 1); }
    setMapValue(creator, currentTx.sender, ZERO);
}

long isSenderCharacter() {
    long trustedHash = getMapValue(K_TRUSTED_HASH_K1, K_TRUSTED_HASH_K2);
    if (trustedHash == ZERO) { return ZERO; }
    return getCodeHashOf(currentTx.sender) == trustedHash;
}
