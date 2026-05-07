#program name SrankReg
#program description Signarank Gamemaster Registry (singleton)
#program activationAmount 100000000
#pragma optimizationLevel 3
#pragma verboseAssembly false
#pragma maxAuxVars 3
#pragma version 2.3.0

// Method codes
#define M_SET_CONSTRUCT_HASH   1
#define M_SET_CHARACTER_HASH   2
#define M_SET_LEVEL_THRESHOLD  3
#define M_REGISTER_ITEM       10
#define M_UNREGISTER_ITEM     11
#define M_SET_ITEM_EFFECT     12
#define M_REGISTER_EFFECT     20
#define M_UNREGISTER_EFFECT   21

// Global Settings keys (k1)
#define G_CONSTRUCT_HASH  1
#define G_CHARACTER_HASH  2
#define G_LEVEL_THRESHOLD 10

// Item property keys (k2; k1 = tokenId)
#define IK_TYPE         1
#define IK_STACK_LIMIT  2
#define IK_MIN_LEVEL    3
#define IK_EFFECT_COUNT 4
#define IK_EFFECT_BASE  10

// Effect property keys (k2; k1 = effectId)
#define EK_TARGET   1
#define EK_BONUSABS 2
#define EK_BONUSREL 3
#define EK_MODE     4
#define EK_DURATION 5

// Limits
#define MAX_EFFECT_SLOTS_PER_ITEM 8
#define MAX_EFFECT_ID             999999
#define MIN_MODE                  1
#define MAX_MODE                  5
#define ITEM_EQUIPMENT            1
#define ITEM_CONSUMABLE           2

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
        if (currentTx.sender != getCreator()) { continue; }

        switch (currentTx.message[0]) {
            case M_SET_CONSTRUCT_HASH:
                setMapValue(G_CONSTRUCT_HASH, ZERO, currentTx.message[1]);
            break;
            case M_SET_CHARACTER_HASH:
                setMapValue(G_CHARACTER_HASH, ZERO, currentTx.message[1]);
            break;
            case M_SET_LEVEL_THRESHOLD:
                setMapValue(G_LEVEL_THRESHOLD, currentTx.message[1], currentTx.message[2]);
            break;
            case M_REGISTER_EFFECT:
                registerEffect();
            break;
            case M_UNREGISTER_EFFECT:
                unregisterEffect();
            break;
            case M_REGISTER_ITEM:
                registerItem();
            break;
            case M_UNREGISTER_ITEM:
                unregisterItem();
            break;
            case M_SET_ITEM_EFFECT:
                setItemEffect();
            break;
        }
    }
}

void registerEffect() {
    long effectId = currentTx.message[1];
    long packed1  = currentTx.message[2];
    long packed2  = currentTx.message[3];

    if (effectId == ZERO) { return; }
    if (effectId > MAX_EFFECT_ID) { return; }

    long target   = packed1 & 0xFF;
    long mode     = (packed1 >> 8) & 0xFF;
    long bonusAbs = packed2 & 0xFFFF;
    long bonusRel = (packed2 >> 16) & 0xFFFF;
    long duration = (packed2 >> 32) & 0xFFFFFFFF;

    if (mode < MIN_MODE || mode > MAX_MODE) { return; }

    setMapValue(effectId, EK_TARGET,   target);
    setMapValue(effectId, EK_MODE,     mode);
    setMapValue(effectId, EK_BONUSABS, bonusAbs);
    setMapValue(effectId, EK_BONUSREL, bonusRel);
    setMapValue(effectId, EK_DURATION, duration);
}

void unregisterEffect() {
    long effectId = currentTx.message[1];
    if (effectId == ZERO) { return; }
    setMapValue(effectId, EK_TARGET,   ZERO);
    setMapValue(effectId, EK_MODE,     ZERO);
    setMapValue(effectId, EK_BONUSABS, ZERO);
    setMapValue(effectId, EK_BONUSREL, ZERO);
    setMapValue(effectId, EK_DURATION, ZERO);
}

void registerItem() {
    long tokenId = currentTx.message[1];
    long packed1 = currentTx.message[2];
    long packed2 = currentTx.message[3];

    if (tokenId == ZERO) { return; }

    long itemType    = packed1 & 0xFF;
    long stackLimit  = (packed1 >> 8) & 0xFF;
    long minLevel    = (packed1 >> 16) & 0xFF;
    long effectCount = packed2 & 0xFF;

    if (itemType != ITEM_EQUIPMENT && itemType != ITEM_CONSUMABLE) { return; }
    if (effectCount > MAX_EFFECT_SLOTS_PER_ITEM) { return; }

    setMapValue(tokenId, IK_TYPE,         itemType);
    setMapValue(tokenId, IK_STACK_LIMIT,  stackLimit);
    setMapValue(tokenId, IK_MIN_LEVEL,    minLevel);
    setMapValue(tokenId, IK_EFFECT_COUNT, effectCount);
}

void unregisterItem() {
    long tokenId = currentTx.message[1];
    if (tokenId == ZERO) { return; }
    setMapValue(tokenId, IK_TYPE,         ZERO);
    setMapValue(tokenId, IK_STACK_LIMIT,  ZERO);
    setMapValue(tokenId, IK_MIN_LEVEL,    ZERO);
    setMapValue(tokenId, IK_EFFECT_COUNT, ZERO);
    long i;
    for (i = 0; i < MAX_EFFECT_SLOTS_PER_ITEM; ++i) {
        setMapValue(tokenId, IK_EFFECT_BASE + i, ZERO);
    }
}

void setItemEffect() {
    long tokenId  = currentTx.message[1];
    long slot     = currentTx.message[2];
    long effectId = currentTx.message[3];

    if (tokenId == ZERO) { return; }
    if (slot < ZERO || slot >= MAX_EFFECT_SLOTS_PER_ITEM) { return; }

    setMapValue(tokenId, IK_EFFECT_BASE + slot, effectId);

    long currentCount = getMapValue(tokenId, IK_EFFECT_COUNT);
    if (slot >= currentCount) {
        setMapValue(tokenId, IK_EFFECT_COUNT, slot + 1);
    }
}
