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

// Registry key namespace (k1):
//   Globals + Effects live in [REGISTRY_BASE, MAX_LONG] — high end of long.
//   Items use everything below REGISTRY_BASE, including negative longs
//   (= uint64 token IDs whose bit 63 is set).
//   Collision probability for a random asset ID: 2^20 / 2^64 ≈ 5×10^-14.
#define REGISTRY_BASE  0x7FFFFFFFFFF00000

// Global Settings keys (k1)
#define G_CONSTRUCT_HASH  (REGISTRY_BASE + 1)
#define G_CHARACTER_HASH  (REGISTRY_BASE + 2)
#define G_LEVEL_THRESHOLD (REGISTRY_BASE + 10)
// Error log: k1 = G_ERROR_LOG, k2 = txId, value = error code
#define G_ERROR_LOG       (REGISTRY_BASE + 99)

// Error codes (written to G_ERROR_LOG when a creator tx is rejected by a gate)
#define ERR_TOKEN_ID_INVALID      1
#define ERR_EFFECT_ID_INVALID     2
#define ERR_INVALID_ITEM_TYPE     3
#define ERR_INVALID_MODE          4
#define ERR_INVALID_SLOT          5
#define ERR_EFFECT_COUNT_INVALID  6

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
#define MIN_EFFECT_ID             (REGISTRY_BASE + 100)
#define MAX_EFFECT_ID             (REGISTRY_BASE + 999999)
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

void _registerError(long errorCode) {
    setMapValue(G_ERROR_LOG, currentTx.txId, errorCode);
}

void registerEffect() {
    long effectId = currentTx.message[1];
    long packed1  = currentTx.message[2];
    long packed2  = currentTx.message[3];

    if (effectId < MIN_EFFECT_ID || effectId > MAX_EFFECT_ID) {
        _registerError(ERR_EFFECT_ID_INVALID);
        return;
    }

    long target   = packed1 & 0xFF;
    long mode     = (packed1 >> 8) & 0xFF;
    long bonusAbs = packed2 & 0xFFFF;
    long bonusRel = (packed2 >> 16) & 0xFFFF;
    long duration = (packed2 >> 32) & 0xFFFFFFFF;

    if (mode < MIN_MODE || mode > MAX_MODE) {
        _registerError(ERR_INVALID_MODE);
        return;
    }

    setMapValue(effectId, EK_TARGET,   target);
    setMapValue(effectId, EK_MODE,     mode);
    setMapValue(effectId, EK_BONUSABS, bonusAbs);
    setMapValue(effectId, EK_BONUSREL, bonusRel);
    setMapValue(effectId, EK_DURATION, duration);
}

void unregisterEffect() {
    long effectId = currentTx.message[1];
    if (effectId < MIN_EFFECT_ID || effectId > MAX_EFFECT_ID) {
        _registerError(ERR_EFFECT_ID_INVALID);
        return;
    }
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

    if (tokenId == ZERO || tokenId >= REGISTRY_BASE) {
        _registerError(ERR_TOKEN_ID_INVALID);
        return;
    }

    long itemType    = packed1 & 0xFF;
    long stackLimit  = (packed1 >> 8) & 0xFF;
    long minLevel    = (packed1 >> 16) & 0xFF;
    long effectCount = packed2 & 0xFF;

    if (itemType != ITEM_EQUIPMENT && itemType != ITEM_CONSUMABLE) {
        _registerError(ERR_INVALID_ITEM_TYPE);
        return;
    }
    if (effectCount > MAX_EFFECT_SLOTS_PER_ITEM) {
        _registerError(ERR_EFFECT_COUNT_INVALID);
        return;
    }

    setMapValue(tokenId, IK_TYPE,         itemType);
    setMapValue(tokenId, IK_STACK_LIMIT,  stackLimit);
    setMapValue(tokenId, IK_MIN_LEVEL,    minLevel);
    setMapValue(tokenId, IK_EFFECT_COUNT, effectCount);

    // Clear stale slots above effectCount on re-registration.
    // Intentional fallthrough (no `break`): entering at case N clears slots N..7
    // via the jump table — single branch, no induction variable.
    switch (effectCount) {
        case 0: setMapValue(tokenId, IK_EFFECT_BASE + 0, ZERO);
        case 1: setMapValue(tokenId, IK_EFFECT_BASE + 1, ZERO);
        case 2: setMapValue(tokenId, IK_EFFECT_BASE + 2, ZERO);
        case 3: setMapValue(tokenId, IK_EFFECT_BASE + 3, ZERO);
        case 4: setMapValue(tokenId, IK_EFFECT_BASE + 4, ZERO);
        case 5: setMapValue(tokenId, IK_EFFECT_BASE + 5, ZERO);
        case 6: setMapValue(tokenId, IK_EFFECT_BASE + 6, ZERO);
        case 7: setMapValue(tokenId, IK_EFFECT_BASE + 7, ZERO);
    }
}

void unregisterItem() {
    long tokenId = currentTx.message[1];
    if (tokenId == ZERO || tokenId >= REGISTRY_BASE) {
        _registerError(ERR_TOKEN_ID_INVALID);
        return;
    }
    setMapValue(tokenId, IK_TYPE,         ZERO);
    setMapValue(tokenId, IK_STACK_LIMIT,  ZERO);
    setMapValue(tokenId, IK_MIN_LEVEL,    ZERO);
    setMapValue(tokenId, IK_EFFECT_COUNT, ZERO);

    // clear effects
    setMapValue(tokenId, IK_EFFECT_BASE + 0, ZERO);
    setMapValue(tokenId, IK_EFFECT_BASE + 1, ZERO);
    setMapValue(tokenId, IK_EFFECT_BASE + 2, ZERO);
    setMapValue(tokenId, IK_EFFECT_BASE + 3, ZERO);
    setMapValue(tokenId, IK_EFFECT_BASE + 4, ZERO);
    setMapValue(tokenId, IK_EFFECT_BASE + 5, ZERO);
    setMapValue(tokenId, IK_EFFECT_BASE + 6, ZERO);
    setMapValue(tokenId, IK_EFFECT_BASE + 7, ZERO);
}

void setItemEffect() {
    long tokenId  = currentTx.message[1];
    long slot     = currentTx.message[2];
    long effectId = currentTx.message[3];

    if (tokenId == ZERO || tokenId >= REGISTRY_BASE) {
        _registerError(ERR_TOKEN_ID_INVALID);
        return;
    }
    if (slot < ZERO || slot >= MAX_EFFECT_SLOTS_PER_ITEM) {
        _registerError(ERR_INVALID_SLOT);
        return;
    }

    setMapValue(tokenId, IK_EFFECT_BASE + slot, effectId);

    long currentCount = getMapValue(tokenId, IK_EFFECT_COUNT);
    if (slot >= currentCount) {
        setMapValue(tokenId, IK_EFFECT_COUNT, slot + 1);
    }
}
