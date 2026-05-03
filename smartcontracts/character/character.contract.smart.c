#program name Character
#program description Signarank Character Contract
#program activationAmount 100000000
#pragma optimizationLevel 2
#pragma verboseAssembly false
#pragma maxAuxVars 5
#pragma version 2.3.0

// ---- Owner method codes (message[0])
#define METHOD_ATTACK              1
#define METHOD_ALLOCATE_SKILL      2
#define METHOD_COLLECT_ITEMS       3
#define METHOD_MIGRATE             4
#define METHOD_EMERGENCY_WITHDRAW  5
#define METHOD_SET_LEVEL_THRESHOLD 6
#define METHOD_USE_ITEM            7

// ---- Incoming from Construct (message[0])
#define METHOD_COUNTER_ATTACK  100
#define METHOD_BUFF            102
#define METHOD_DEBUFF          103

// ---- KKV map keys (key1), key2=0 for scalar state
#define MAP_CHAR_STRENGTH     100
#define MAP_CHAR_STAMINA      101
#define MAP_CHAR_DEXTERITY    102
#define MAP_CHAR_LUCK         103
#define MAP_CHAR_WILLPOWER    104

#define MAP_CHAR_HP           200
#define MAP_CHAR_MAX_HP       201
#define MAP_CHAR_IS_DEAD      202
#define MAP_CHAR_LEVEL        203
#define MAP_CHAR_SKILL_PTS    204
#define MAP_CHAR_INV_COUNT    205
#define MAP_CHAR_MAX_INV_SLOTS 206

#define MAP_FROZEN_UNTIL      300
#define MAP_STUNNED_UNTIL     301
#define MAP_DEBUFF_STACKS     302

#define MAP_EQUIP_ATK_ABS     400
#define MAP_EQUIP_ATK_REL     401
#define MAP_EQUIP_HP_ABS      402
#define MAP_EQUIP_STR_BONUS   403
#define MAP_EQUIP_STA_BONUS   404
#define MAP_EQUIP_DEX_BONUS   405
#define MAP_EQUIP_LCK_BONUS   406
#define MAP_EQUIP_WIL_BONUS   407

#define MAP_LEVEL_THRESHOLD   500

// ---- Item Registry property keys (must match item-registry contract)
#define REG_ITEM_TYPE      1
#define REG_EFFECT_TARGET  2
#define REG_BONUS_ABS      3
#define REG_BONUS_REL      4
#define REG_STACK_LIMIT    5
#define REG_MIN_LEVEL      6
#define REG_IS_BURNABLE    7

// ---- Item types
#define ITEM_EQUIPMENT  1
#define ITEM_CONSUMABLE 2

// ---- Effect targets
#define TARGET_ATTACK    0
#define TARGET_HP        1
#define TARGET_STR       2
#define TARGET_STA       3
#define TARGET_DEX       4
#define TARGET_LCK       5
#define TARGET_WIL       6
#define TARGET_INV_SLOTS 7

// ---- Status effects
#define STATUS_NONE     0
#define STATUS_FROZEN   1
#define STATUS_STUNNED  2
#define STATUS_WEAKENED 3

// ---- Attribute indices
#define ATTR_STRENGTH  0
#define ATTR_STAMINA   1
#define ATTR_DEXTERITY 2
#define ATTR_LUCK      3
#define ATTR_WILLPOWER 4
#define ATTR_MAX_INDEX 4
#define ATTR_MAX_VALUE 5

// ---- Starting state
#define STARTING_SKILL_POINTS  10
#define DEFAULT_BASE_HP        100
#define HP_PER_STAMINA         20
#define DEFAULT_MAX_INV_SLOTS  10

// ---- Deploy-time parameters
long itemRegistryId;
long xpTokenId;
long revivalTokenId;
long constructId;

#ifdef TESTBED
    const itemRegistryId  = TESTBED_itemRegistryId;
    const xpTokenId       = TESTBED_xpTokenId;
    const revivalTokenId  = TESTBED_revivalTokenId;
    const constructId     = TESTBED_constructId;
#endif

long ZERO;
const ZERO = 0;

struct TX {
    long txId;
    long sender;
    long height;
    long assetIds[4];
    long message[4];
} currentTx;

long messageBuffer[4];

init();

void init() {
    if (getMapValue(MAP_CHAR_MAX_HP, 0) > ZERO) { return; } // guard: only run once
    setMapValue(MAP_CHAR_SKILL_PTS,     0, STARTING_SKILL_POINTS);
    setMapValue(MAP_CHAR_MAX_INV_SLOTS, 0, DEFAULT_MAX_INV_SLOTS);
    setMapValue(MAP_CHAR_LEVEL,         0, 1);
    setMapValue(MAP_CHAR_MAX_HP,        0, DEFAULT_BASE_HP);
    setMapValue(MAP_CHAR_HP,            0, DEFAULT_BASE_HP);
}

void main() {
    currentTx.height = getCurrentBlockheight();

    while ((currentTx.txId = getNextTx()) != ZERO) {
        currentTx.sender = getSender(currentTx.txId);
        readMessage(currentTx.txId, 0, currentTx.message);
        readAssets(currentTx.txId, currentTx.assetIds);

        if (currentTx.sender == getCreator()) {
            handleOwnerMessage();
        } else if (currentTx.sender == constructId) {
            handleConstructMessage();
        }
    }
}

void handleOwnerMessage() {
    if (currentTx.assetIds[0] != ZERO) {
        if (currentTx.assetIds[0] == revivalTokenId) {
            handleRevival();
        } else {
            handleItemReceipt();
        }
        return;
    }
    switch (currentTx.message[0]) {
        case METHOD_ATTACK:              doAttack();           break;
        case METHOD_ALLOCATE_SKILL:      allocateSkill();      break;
        case METHOD_COLLECT_ITEMS:       collectItems();       break;
        case METHOD_MIGRATE:             migrate();            break;
        case METHOD_EMERGENCY_WITHDRAW:  emergencyWithdraw();  break;
        case METHOD_SET_LEVEL_THRESHOLD: setLevelThreshold();  break;
        case METHOD_USE_ITEM:            useItem();            break;
    }
}

void handleConstructMessage() {
    switch (currentTx.message[0]) {
        case METHOD_COUNTER_ATTACK: handleCounterAttack(); break;
        case METHOD_BUFF:           handleBuff();          break;
        case METHOD_DEBUFF:         handleDebuff();        break;
    }
    checkLevelUp();
}

void doAttack() {
    long isDead = getMapValue(MAP_CHAR_IS_DEAD, 0);
    if (isDead != ZERO) {
        sendAmount(getAmount(currentTx.txId), getCreator());
        if (currentTx.assetIds[0] != ZERO) {
            sendQuantity(getQuantity(currentTx.txId, currentTx.assetIds[0]), currentTx.assetIds[0], getCreator());
        }
        return;
    }

    long frozenUntil  = getMapValue(MAP_FROZEN_UNTIL, 0);
    long stunnedUntil = getMapValue(MAP_STUNNED_UNTIL, 0);
    if (currentTx.height <= frozenUntil || currentTx.height <= stunnedUntil) {
        sendAmount(getAmount(currentTx.txId), getCreator());
        if (currentTx.assetIds[0] != ZERO) {
            sendQuantity(getQuantity(currentTx.txId, currentTx.assetIds[0]), currentTx.assetIds[0], getCreator());
        }
        return;
    }

    long target = currentTx.message[1];
    if (target == ZERO) { target = constructId; }

    if (currentTx.assetIds[0] != ZERO) {
        sendQuantity(getQuantity(currentTx.txId, currentTx.assetIds[0]), currentTx.assetIds[0], target);
    }
    sendAmount(getAmount(currentTx.txId), target);
}

void allocateSkill() {
    long pts = getMapValue(MAP_CHAR_SKILL_PTS, 0);
    if (pts <= ZERO) { return; }

    long attrIndex = currentTx.message[1];
    if (attrIndex < ZERO || attrIndex > ATTR_MAX_INDEX) { return; }

    long mapKey = MAP_CHAR_STRENGTH + attrIndex;
    long current = getMapValue(mapKey, 0);
    if (current >= ATTR_MAX_VALUE) { return; }

    setMapValue(mapKey, 0, current + 1);
    setMapValue(MAP_CHAR_SKILL_PTS, 0, pts - 1);

    if (attrIndex == ATTR_STAMINA) {
        long maxHp = getMapValue(MAP_CHAR_MAX_HP, 0);
        long hp    = getMapValue(MAP_CHAR_HP, 0);
        setMapValue(MAP_CHAR_MAX_HP, 0, maxHp + HP_PER_STAMINA);
        setMapValue(MAP_CHAR_HP,     0, hp + HP_PER_STAMINA);
    }
}

void handleCounterAttack() {
    long damage         = currentTx.message[1];
    long statusEffect   = currentTx.message[2];
    long statusDuration = currentTx.message[3];

    long hp = getMapValue(MAP_CHAR_HP, 0);
    hp -= damage;
    if (hp <= ZERO) {
        setMapValue(MAP_CHAR_HP, 0, ZERO);
        triggerDeath();
        return;
    }
    setMapValue(MAP_CHAR_HP, 0, hp);

    if (statusEffect == STATUS_FROZEN) {
        setMapValue(MAP_FROZEN_UNTIL, 0, currentTx.height + statusDuration);
    } else if (statusEffect == STATUS_STUNNED) {
        setMapValue(MAP_STUNNED_UNTIL, 0, currentTx.height + statusDuration);
    } else if (statusEffect == STATUS_WEAKENED) {
        long stacks = getMapValue(MAP_DEBUFF_STACKS, 0);
        setMapValue(MAP_DEBUFF_STACKS, 0, stacks + 1);
    }
}

void triggerDeath() {
    setMapValue(MAP_CHAR_IS_DEAD, 0, 1);

    long penaltyPoints = (getWeakRandomNumber() >> 1) % 3 + 1;
    long i = 0;
    while (i < penaltyPoints) {
        long attrIdx = (getWeakRandomNumber() >> 1) % 5;
        long mapKey  = MAP_CHAR_STRENGTH + attrIdx;
        long val     = getMapValue(mapKey, 0);
        if (val > ZERO) {
            setMapValue(mapKey, 0, val - 1);
        }
        i++;
    }
}

void handleRevival() {
    long isDead = getMapValue(MAP_CHAR_IS_DEAD, 0);
    if (isDead == ZERO) { return; }

    setMapValue(MAP_CHAR_IS_DEAD, 0, ZERO);
    long maxHp = getMapValue(MAP_CHAR_MAX_HP, 0);
    setMapValue(MAP_CHAR_HP, 0, maxHp);

    sendQuantity(1, revivalTokenId, ZERO); // burn
}

void handleBuff() { /* reserved */ }

void handleDebuff() {
    long stacks = getMapValue(MAP_DEBUFF_STACKS, 0);
    setMapValue(MAP_DEBUFF_STACKS, 0, stacks + 1);
}

void handleItemReceipt() {
    long tokenId = currentTx.assetIds[0];
    if (tokenId == ZERO) { return; }

    long itemType = getExtMapValue(REG_ITEM_TYPE, tokenId, itemRegistryId);
    if (itemType == ZERO) {
        sendQuantity(getQuantity(currentTx.txId, tokenId), tokenId, getCreator());
        return;
    }

    long stackLimit = getExtMapValue(REG_STACK_LIMIT, tokenId, itemRegistryId);
    long minLevel   = getExtMapValue(REG_MIN_LEVEL,   tokenId, itemRegistryId);
    long charLevel  = getMapValue(MAP_CHAR_LEVEL, 0);

    if (charLevel < minLevel) {
        sendQuantity(getQuantity(currentTx.txId, tokenId), tokenId, getCreator());
        return;
    }

    long incoming = getQuantity(currentTx.txId, tokenId);
    long current  = getAssetBalance(tokenId);
    long maxSlots = getMapValue(MAP_CHAR_MAX_INV_SLOTS, 0);
    long invCount = getMapValue(MAP_CHAR_INV_COUNT, 0);

    if (stackLimit <= ZERO) { stackLimit = 1; }
    long canAccept = stackLimit - current;
    if (canAccept <= ZERO) {
        sendQuantity(incoming, tokenId, getCreator());
        return;
    }
    if (incoming > canAccept) {
        sendQuantity(incoming - canAccept, tokenId, getCreator());
        incoming = canAccept;
    }

    if (invCount + incoming > maxSlots) {
        sendQuantity(incoming, tokenId, getCreator());
        return;
    }

    setMapValue(MAP_CHAR_INV_COUNT, 0, invCount + incoming);
    updateEquipmentBonuses(tokenId, incoming);
}

void updateEquipmentBonuses(long tokenId, long quantity) {
    long itemType  = getExtMapValue(REG_ITEM_TYPE,     tokenId, itemRegistryId);
    if (itemType != ITEM_EQUIPMENT) { return; }

    long effTarget = getExtMapValue(REG_EFFECT_TARGET, tokenId, itemRegistryId);
    long bonusAbs  = getExtMapValue(REG_BONUS_ABS,     tokenId, itemRegistryId);
    long bonusRel  = getExtMapValue(REG_BONUS_REL,     tokenId, itemRegistryId);
    long cur;
    long mapKey;

    if (effTarget == TARGET_ATTACK) {
        if (bonusAbs > ZERO) {
            cur = getMapValue(MAP_EQUIP_ATK_ABS, 0);
            setMapValue(MAP_EQUIP_ATK_ABS, 0, cur + bonusAbs * quantity);
        }
        if (bonusRel > ZERO) {
            cur = getMapValue(MAP_EQUIP_ATK_REL, 0);
            setMapValue(MAP_EQUIP_ATK_REL, 0, cur + (bonusRel - 100) * quantity);
        }
    } else if (effTarget == TARGET_HP) {
        cur = getMapValue(MAP_EQUIP_HP_ABS, 0);
        setMapValue(MAP_EQUIP_HP_ABS, 0, cur + bonusAbs * quantity);
    } else if (effTarget == TARGET_INV_SLOTS) {
        cur = getMapValue(MAP_CHAR_MAX_INV_SLOTS, 0);
        setMapValue(MAP_CHAR_MAX_INV_SLOTS, 0, cur + bonusAbs * quantity);
    } else if (effTarget >= TARGET_STR && effTarget <= TARGET_WIL) {
        mapKey = MAP_EQUIP_STR_BONUS + (effTarget - TARGET_STR);
        cur    = getMapValue(mapKey, 0);
        setMapValue(mapKey, 0, cur + bonusAbs * quantity);
    }
}

void useItem() {
    long tokenId = currentTx.message[1];
    if (tokenId == ZERO) { return; }

    long itemType = getExtMapValue(REG_ITEM_TYPE, tokenId, itemRegistryId);
    if (itemType != ITEM_CONSUMABLE) { return; }
    if (getAssetBalance(tokenId) <= ZERO) { return; }

    long effTarget = getExtMapValue(REG_EFFECT_TARGET, tokenId, itemRegistryId);
    long bonusAbs  = getExtMapValue(REG_BONUS_ABS,     tokenId, itemRegistryId);

    if (effTarget == TARGET_HP) {
        long hp    = getMapValue(MAP_CHAR_HP, 0);
        long maxHp = getMapValue(MAP_CHAR_MAX_HP, 0);
        hp += bonusAbs;
        if (hp > maxHp) { hp = maxHp; }
        setMapValue(MAP_CHAR_HP, 0, hp);
    } else if (effTarget >= TARGET_STR && effTarget <= TARGET_WIL) {
        long mapKey = MAP_CHAR_STRENGTH + (effTarget - TARGET_STR);
        long cur    = getMapValue(mapKey, 0);
        if (cur < ATTR_MAX_VALUE) {
            setMapValue(mapKey, 0, cur + 1);
        }
    }

    sendQuantity(1, tokenId, ZERO); // burn
    long inv = getMapValue(MAP_CHAR_INV_COUNT, 0);
    if (inv > ZERO) { setMapValue(MAP_CHAR_INV_COUNT, 0, inv - 1); }
}

void collectItems() {
    long tokenId = currentTx.message[1];
    if (tokenId == ZERO) { return; }
    long balance = getAssetBalance(tokenId);
    if (balance <= ZERO) { return; }
    sendQuantity(balance, tokenId, getCreator());
    long inv = getMapValue(MAP_CHAR_INV_COUNT, 0);
    if (inv >= balance) { setMapValue(MAP_CHAR_INV_COUNT, 0, inv - balance); }
    else { setMapValue(MAP_CHAR_INV_COUNT, 0, ZERO); }
}

void emergencyWithdraw() {
    sendAmount(getCurrentBalance(), getCreator());
}

void setLevelThreshold() {
    long level    = currentTx.message[1];
    long xpNeeded = currentTx.message[2];
    if (level <= 1 || level > 100) { return; }
    if (xpNeeded <= ZERO) { return; }
    setMapValue(MAP_LEVEL_THRESHOLD, level, xpNeeded);
}

long getLevelThreshold(long level) {
    long stored = getMapValue(MAP_LEVEL_THRESHOLD, level);
    if (stored > ZERO) { return stored; }
    long threshold = 1000;
    long i = 1;
    while (i < level) {
        threshold = threshold * 2;
        i++;
    }
    return threshold;
}

void checkLevelUp() {
    long xp       = getAssetBalance(xpTokenId);
    long level    = getMapValue(MAP_CHAR_LEVEL, 0);
    long skillPts = getMapValue(MAP_CHAR_SKILL_PTS, 0);
    long leveled  = 0;
    long nextThreshold = getLevelThreshold(level + 1);

    while (xp >= nextThreshold && level < 100) {
        level++;
        skillPts++;
        leveled = 1;
        nextThreshold = getLevelThreshold(level + 1);
    }

    if (leveled) {
        setMapValue(MAP_CHAR_LEVEL,     0, level);
        setMapValue(MAP_CHAR_SKILL_PTS, 0, skillPts);
    }
}

void migrate() {
    long oldCharId = currentTx.message[1];
    if (oldCharId == ZERO) { return; }

    setMapValue(MAP_CHAR_STRENGTH,  0, getExtMapValue(MAP_CHAR_STRENGTH,  0, oldCharId));
    setMapValue(MAP_CHAR_STAMINA,   0, getExtMapValue(MAP_CHAR_STAMINA,   0, oldCharId));
    setMapValue(MAP_CHAR_DEXTERITY, 0, getExtMapValue(MAP_CHAR_DEXTERITY, 0, oldCharId));
    setMapValue(MAP_CHAR_LUCK,      0, getExtMapValue(MAP_CHAR_LUCK,      0, oldCharId));
    setMapValue(MAP_CHAR_WILLPOWER, 0, getExtMapValue(MAP_CHAR_WILLPOWER, 0, oldCharId));
    setMapValue(MAP_CHAR_LEVEL,     0, getExtMapValue(MAP_CHAR_LEVEL,     0, oldCharId));
    setMapValue(MAP_CHAR_SKILL_PTS, 0, getExtMapValue(MAP_CHAR_SKILL_PTS, 0, oldCharId));

    long sta = getMapValue(MAP_CHAR_STAMINA, 0);
    setMapValue(MAP_CHAR_MAX_HP, 0, DEFAULT_BASE_HP + sta * HP_PER_STAMINA);
    setMapValue(MAP_CHAR_HP,     0, DEFAULT_BASE_HP + sta * HP_PER_STAMINA);
}
