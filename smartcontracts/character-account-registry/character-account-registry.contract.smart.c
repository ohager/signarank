#program name CharAcctReg
#program description Signarank Character-Account Registry (singleton)
#program activationAmount 100000000
#pragma optimizationLevel 3
#pragma verboseAssembly false
#pragma maxAuxVars 3
#pragma version 2.3.0

// Method codes
#define M_SET_CHARACTER_HASH  1
#define M_REGISTER_CHARACTER  2

// Trusted-hash slot (k1, k2). Uses (0, 0); chain-issued account IDs are
// large numbers and never collide with this fixed marker.
#define K_TRUSTED_HASH_K1 0
#define K_TRUSTED_HASH_K2 0

long ZERO;
const ZERO = 0;

struct TX {
    long txId;
    long sender;
    long message[4];
} currentTx;

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
                    // Index entry: (creatorAccount, characterId) -> codehash.
                    // Value carries the version (codehash at registration time)
                    // so readers can distinguish between contract revisions.
                    setMapValue(getCreatorOf(currentTx.sender), currentTx.sender, getCodeHashOf(currentTx.sender));
                break;
            }
        }
    }
}

long isSenderCharacter() {
    long trustedHash = getMapValue(K_TRUSTED_HASH_K1, K_TRUSTED_HASH_K2);
    if (trustedHash == ZERO) { return ZERO; }
    return getCodeHashOf(currentTx.sender) == trustedHash;
}
