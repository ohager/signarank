#program name ItemReg
#program description Global Item Registry for Signarank Characters
#program activationAmount 100000000
#pragma optimizationLevel 2
#pragma verboseAssembly false
#pragma maxAuxVars 3
#pragma version 2.3.0

// Method codes
#define REGISTER_ITEM   1
#define UNREGISTER_ITEM 2

// KKV property keys (key1)
#define PROP_ITEM_TYPE      1
#define PROP_EFFECT_TARGET  2
#define PROP_BONUS_ABS      3
#define PROP_BONUS_REL      4
#define PROP_STACK_LIMIT    5
#define PROP_MIN_LEVEL      6
#define PROP_IS_BURNABLE    7

// Item type values
#define ITEM_EQUIPMENT  1
#define ITEM_CONSUMABLE 2

// Effect target values
#define TARGET_ATTACK    0
#define TARGET_HP        1
#define TARGET_STR       2
#define TARGET_STA       3
#define TARGET_DEX       4
#define TARGET_LCK       5
#define TARGET_WIL       6
#define TARGET_INV_SLOTS 7

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
                case REGISTER_ITEM:
                    registerItem();
                break;
                case UNREGISTER_ITEM:
                    unregisterItem();
                break;
            }
        }
    }
}

void registerItem() {
    // message layout:
    // [0] = REGISTER_ITEM
    // [1] = tokenId
    // [2] = packed: itemType(8) | effectTarget(8) | stackLimit(8) | minLevel(8) | isBurnable(8)
    // [3] = packed: bonusAbs(32) | bonusRel(32)
    long tokenId = currentTx.message[1];
    long packed1 = currentTx.message[2];
    long packed2 = currentTx.message[3];

    if (tokenId == ZERO) { return; }

    long itemType   = packed1 & 0xFF;
    long effTarget  = (packed1 >> 8) & 0xFF;
    long stackLimit = (packed1 >> 16) & 0xFF;
    long minLevel   = (packed1 >> 24) & 0xFF;
    long isBurnable = (packed1 >> 32) & 0xFF;
    long bonusAbs   = packed2 & 0xFFFFFFFF;
    long bonusRel   = (packed2 >> 32) & 0xFFFFFFFF;

    if (itemType != ITEM_EQUIPMENT && itemType != ITEM_CONSUMABLE) { return; }
    if (stackLimit <= ZERO) { stackLimit = 1; }

    setMapValue(PROP_ITEM_TYPE,     tokenId, itemType);
    setMapValue(PROP_EFFECT_TARGET, tokenId, effTarget);
    setMapValue(PROP_BONUS_ABS,     tokenId, bonusAbs);
    setMapValue(PROP_BONUS_REL,     tokenId, bonusRel);
    setMapValue(PROP_STACK_LIMIT,   tokenId, stackLimit);
    setMapValue(PROP_MIN_LEVEL,     tokenId, minLevel);
    setMapValue(PROP_IS_BURNABLE,   tokenId, isBurnable);
}

void unregisterItem() {
    long tokenId = currentTx.message[1];
    if (tokenId == ZERO) { return; }
    setMapValue(PROP_ITEM_TYPE,     tokenId, ZERO);
    setMapValue(PROP_EFFECT_TARGET, tokenId, ZERO);
    setMapValue(PROP_BONUS_ABS,     tokenId, ZERO);
    setMapValue(PROP_BONUS_REL,     tokenId, ZERO);
    setMapValue(PROP_STACK_LIMIT,   tokenId, ZERO);
    setMapValue(PROP_MIN_LEVEL,     tokenId, ZERO);
    setMapValue(PROP_IS_BURNABLE,   tokenId, ZERO);
}
