#program name Character
#program description SignaRank Character Contract
#program activationAmount 200000000
#pragma optimizationLevel 3
#pragma verboseAssembly false
#pragma maxAuxVars 3
#pragma version 2.3.0

// FIXME: The value needs to be defined for SIM, TESTNET and MAINNET
// It's the game master registry contract
#define GAMEMASTER_REGISTRY 122344543654

// FIXME: The value needs to be defined for SIM, TESTNET and MAINNET
// It's the singleton character-account registry contract (discoverability +
// per-account character cap) — distinct from GAMEMASTER_REGISTRY above.
#define CHAR_REGISTRY 122344543655

// Must mirror gamemaster-registry.contract.smart.c's REGISTRY_BASE exactly —
// that contract stores Globals (incl. the trusted construct hash) at
// REGISTRY_BASE.., and Items below it. Using a different key here silently
// desyncs senderIsConstruct() from whatever the gamemaster actually configures.
#define REGISTRY_BASE 0x7FFFFFFFFFF00000
#define GAMEMASTER_MAP_KEY1_ITEMS 1
#define GAMEMASTER_MAP_KEY1_CONSTRUCT_HASH (REGISTRY_BASE + 1)
#define GAMEMASTER_MAP_KEY2_CHARACTER_HASH 3

// Must mirror character-account-registry.contract.smart.c's method codes exactly.
#define CHAR_REGISTRY_M_REGISTER_CHARACTER   2
#define CHAR_REGISTRY_M_UNREGISTER_CHARACTER 3

// Must mirror gamemaster-registry.contract.smart.c's item/effect key layout
// exactly (see docs/superpowers/specs/2026-05-06-gamemaster-registry-design.md).
// Item properties: key1 = tokenId, key2 = one of these.
#define GAMEMASTER_ITEM_KEY_TYPE         1
#define GAMEMASTER_ITEM_KEY_STACK_LIMIT  2
#define GAMEMASTER_ITEM_KEY_MIN_LEVEL    3
#define GAMEMASTER_ITEM_KEY_EFFECT_COUNT 4
#define GAMEMASTER_ITEM_KEY_EFFECT_BASE  10

// Effect properties: key1 = effectId (already REGISTRY_BASE-offset as stored
// by the gamemaster), key2 = one of these.
#define GAMEMASTER_EFFECT_KEY_TARGET     1
#define GAMEMASTER_EFFECT_KEY_BONUS_ABS  2
#define GAMEMASTER_EFFECT_KEY_BONUS_REL  3
#define GAMEMASTER_EFFECT_KEY_MODE       4
#define GAMEMASTER_EFFECT_KEY_DURATION   5

#define ITEM_TYPE_EQUIPMENT  1
#define ITEM_TYPE_CONSUMABLE 2

// Effect modes — the Character has a hardcoded dispatcher for these; unknown
// modes are silently ignored (forward-compatible with future gamemaster mode
// additions that don't require a Character redeploy).
#define MODE_AGGREGATE_ABS 1
#define MODE_AGGREGATE_REL 2
#define MODE_HEAL          3
#define MODE_REVIVE        4
#define MODE_STATUS_EFFECT 5

// Magic codes for methods - Player Methods
#define ALLOCATE_SKILLPOINT 1
#define ATTACK 2
#define REROLL 3
#define TRANSFER_ITEM 4
#define USE_ITEM 5
#define SEPPUKU 66
#define REFUND 99

// Construct Methods
#define DEDUCT_HITPOINTS 13
#define REROLL_COSTS 100_0000_0000
#define MAX_REROLLS 5

// Leveling is a triangular curve: the XP needed to REACH level N is
// 1000 * N*(N-1)/2 (level 2 = 1000, 3 = 3000, 4 = 6000, 5 = 10000, ...). The
// per-level gap grows linearly (1000 * level), so higher levels cost steadily
// more but never hit the exponential wall that doubling produced.
// MAX_LEVELUPS_PER_ACTIVATION bounds the loop against a one-tx XP windfall.
#define LEVEL_XP_BASE 1000
#define MAX_LEVELUPS_PER_ACTIVATION 50

// On death there is a chance that ONE random inventory item (uniform over held
// units) is dropped and returned to constructorAccount. The chance starts at
// DROP_BASE_CHANCE_PCT and is reduced by LUCK_DROP_REDUCTION_PCT per point of
// LUCK, floored at 0 — a luckier character loses items less often.
#define DROP_BASE_CHANCE_PCT     20
#define LUCK_DROP_REDUCTION_PCT  1

// ---- INCOMING DAMAGE MITIGATION ----
// Constructs send RAW damage; the Character computes NET damage from its OWN
// defensive attributes, so mitigation can never be bypassed construct-side and
// no per-hit cap is needed. A construct is trusted for the raw hit only —
// negative/zero is ignored (it must never be able to heal via a "deduct").
//   dodgeChance% = min(DODGE_MAX_PCT, (dexterity + luck) * DODGE_PCT_PER_POINT)
//   on a dodge the hit deals 0; else net = max(0, raw - stamina*ARMOR_PER_STAMINA)
#define ARMOR_PER_STAMINA    2
#define DODGE_PCT_PER_POINT  2
#define DODGE_MAX_PCT        60


// Maps - accessible by other contracts
#define MAP_KEY1_ATTRIBUTES 1
#define MAP_KEY2_ATTRIBUTES_STRENGTH    1
#define MAP_KEY2_ATTRIBUTES_STAMINA     2
#define MAP_KEY2_ATTRIBUTES_DEXTERITY   3
#define MAP_KEY2_ATTRIBUTES_LUCK        4
#define MAP_KEY2_ATTRIBUTES_WILLPOWER   5


// Dense slot→tokenId index: map[MAP_KEY1_INVENTORY][slot] = tokenId for slot in
// 0..usedInventorySlots-1. One slot per held UNIT (a stack of N consumables
// occupies N slots all holding that tokenId). Kept in sync by _inventoryAdd()/
// _inventoryRemoveOne() so a random held unit can be picked on death.
// items themselves are registered globally on the gamemaster registry.
#define MAP_KEY1_INVENTORY 2

// key2 = effect target (see gamemaster-registry-design.md's Effect Target enum)
#define MAP_KEY1_EQUIP_BONUS_ABS 10
#define MAP_KEY1_EQUIP_BONUS_REL 11
#define MAP_KEY1_STATUS_EFFECTS  12

// ---- ROLLING ERROR LOG ----
// A ring buffer of the last ERROR_LOG_SIZE owner-action failures. Only the
// creator's own actions are logged, so the window can't be flooded by others.
// Frontend: read META (= total ever), then walk slots (META-1)%SIZE downwards.
// Layout: map[MAP_KEY1_ERROR_CODE][slot] = code,
//         map[MAP_KEY1_ERROR_TXID][slot] = failing tx id,
//         map[MAP_KEY1_ERROR_META][0]    = total errors ever (head/count).
#define ERROR_LOG_SIZE       50
#define MAP_KEY1_ERROR_CODE  20
#define MAP_KEY1_ERROR_TXID  21
#define MAP_KEY1_ERROR_META  22

#define ERR_ATTACK_NOT_POSSIBLE     1
#define ERR_REROLL_COMMITTED        2
#define ERR_REROLL_MAX_REACHED      3
#define ERR_REROLL_INSUFFICIENT     4
#define ERR_TRANSFER_TO_CONTRACT    5
#define ERR_TRANSFER_ITEM_NOT_HELD  6
#define ERR_USE_ITEM_NOT_HELD       7
#define ERR_USE_ITEM_NOT_CONSUMABLE 8
#define ERR_DEPOSIT_AMBIGUOUS       9
#define ERR_INVENTORY_FULL          10
#define ERR_ALLOC_NO_SKILLPOINTS    11
#define ERR_ALLOC_INVALID_ATTRIBUTE 12
#define ERR_ITEM_NOT_REGISTERED     13
#define ERR_ITEM_LEVEL_TOO_LOW      14
#define ERR_ITEM_STACK_LIMIT        15
#define ERR_USE_ITEM_NO_EFFECT      16
// Equipment is one-per-slot: a deposit of 2+ units in a single tx is bounced.
#define ERR_EQUIP_MULTI_UNIT        17
// XP is bound to the character forever — it can never be transferred out.
#define ERR_TRANSFER_XP             18
#define ERR_CHARACTER_DEAD          66

// Initializable

long constructorAccount; // the creator of constructs
long xpTokenId;           // native Signum token paid out by Constructs on attack; XP = getAssetBalance(xpTokenId)

#ifdef TESTBED
    const constructorAccount = TESTBED_constructorAccount;
    const xpTokenId = TESTBED_xpTokenId;
#endif


// State variables
long currentHitpoints;
long maxHitpoints;
long isDead;
// Guards handleDead() so its random attribute penalty applies exactly once
// per death. Reset to FALSE by applyEffect()'s MODE_REVIVE branch alongside isDead.
long deathPenaltyApplied;
long skillPoints;
long usedInventorySlots;
long maxInventorySlots;
// Set on the first ATTACK. Locks REROLL and gates SEPPUKU.
long committed;
long rerollCount;
long level;
// XP required to reach level+1. Advances only forward — a level, once
// reached, is never lost even if the XP token balance later drops.
long nextLevelXp;
// Cached at init() via getActivationOf(CHAR_REGISTRY) — getNextTx() only
// surfaces incoming transactions carrying at least the recipient's own
// activation fee, so registry messages must attach it.
long charRegistryActivationFee;
// Total owner-action failures ever recorded — the rolling error log writes to
// slot (errorCount % ERROR_LOG_SIZE).
long errorCount;

long messageBuffer[4];

// Constants
long ZERO;
const ZERO = 0;
long FIVE;
const FIVE = 5;
long FALSE;
const FALSE = 0;
long TRUE;
const TRUE = 1;
long HP_PER_STAMINA;
const HP_PER_STAMINA = 10;


void recalculateDerivedStats() {
    maxHitpoints = 100 + (getMapValue(MAP_KEY1_ATTRIBUTES, MAP_KEY2_ATTRIBUTES_STAMINA) * HP_PER_STAMINA);
    maxInventorySlots = 10 + ((getMapValue(MAP_KEY1_ATTRIBUTES, MAP_KEY2_ATTRIBUTES_STRENGTH)));
}

void rollAttributes() {
    skillPoints = FIVE;
    long index;
    long attrValue;
    while(skillPoints > ZERO){
        index = ((getWeakRandomNumber() >> 1) % FIVE) + 1;
        attrValue = getMapValue(MAP_KEY1_ATTRIBUTES, index);
        setMapValue(MAP_KEY1_ATTRIBUTES, index, attrValue + 1);
        --skillPoints;
    };

    recalculateDerivedStats();
}

void init() {
    rollAttributes();
    currentHitpoints = maxHitpoints;
    usedInventorySlots = ZERO;
    isDead = FALSE;
    committed = FALSE;
    deathPenaltyApplied = FALSE;
    level = 1;
    nextLevelXp = LEVEL_XP_BASE;
    rerollCount = ZERO;
    errorCount = ZERO;

    // Registers this character at the singleton character-account registry so
    // it is discoverable regardless of whether it is ever committed. The
    // registry silently drops the entry if the creator is already at its cap
    // — init() cannot reject the deployment itself.
    charRegistryActivationFee = getActivationOf(CHAR_REGISTRY);
    messageBuffer[0] = CHAR_REGISTRY_M_REGISTER_CHARACTER;
    messageBuffer[1] = ZERO;
    messageBuffer[2] = ZERO;
    messageBuffer[3] = ZERO;
    sendAmountAndMessage(charRegistryActivationFee, messageBuffer, CHAR_REGISTRY);
}

init();

// Structs

// basic tx iteration struct
struct TX {
    long txId;
    long sender;
    long message[4];
    long assetIds[4];
} currentTx;

void main() {
    // Deferred so a same-block ATTACK/REROLL forwards/burns with the balance
    // intact; refunding in-loop could drain the balance first and freeze the
    // contract mid-send (Finding 4). Refund takes whatever is left, post-loop.
    long refundRequested = FALSE;
    while ((currentTx.txId = getNextTx()) != 0) {
        currentTx.sender = getSender(currentTx.txId);
        readMessage(currentTx.txId, 0, currentTx.message);

        // Runs BEFORE dispatch, not after: an asset attached to the SAME
        // transaction as e.g. a USE_ITEM call is already visible via
        // getAssetBalance() by the time that message is processed, so
        // inventory must be credited first — otherwise useItem() would burn
        // and decrement a slot that was never incremented, and the later
        // receiveAssets() pass would then re-credit a slot for a token
        // that's already gone (a permanent phantom slot leak).
        long senderIsOwner = currentTx.sender == getCreator();
        // On an ATTACK the first attached asset is forwarded to the construct by
        // attack(), so receiveAssets() must leave slot 0 untouched instead of
        // shelving it into inventory. Only a live owner-ATTACK qualifies — the
        // exact condition under which attack() below actually runs.
        long isAttack = senderIsOwner == TRUE && currentTx.message[0] == ATTACK && isDead == FALSE;
        receiveAssets(senderIsOwner, isAttack);

        if(senderIsOwner){ // is player
            switch(currentTx.message[0]) {
                case ALLOCATE_SKILLPOINT:
                    if(isDead == FALSE) {
                        allocateSkillPoint(currentTx.message[1]);
                    } else { registerError(ERR_CHARACTER_DEAD); }
                break;
                case ATTACK:
                    if(isDead == FALSE) {
                        attack(currentTx.message[1]);
                    } else { registerError(ERR_CHARACTER_DEAD); }
                break;
                case REROLL:
                    // committed/max/balance checks — and their error logging —
                    // live inside reroll(); only the dead gate stays here.
                    if(isDead == FALSE) {
                        reroll();
                    } else { registerError(ERR_CHARACTER_DEAD); }
                break;
                case TRANSFER_ITEM:
                    transferItem(currentTx.message[1], currentTx.message[2]);
                    break;
                case USE_ITEM:
                    // Ungated here — different effect modes require different
                    // life states (HEAL needs alive, REVIVE needs dead), so
                    // applyEffect() guards per-mode instead of at dispatch.
                    useItem(currentTx.message[1]);
                break;
                case SEPPUKU:
                    if(isDead == TRUE && committed == TRUE){
                        seppuku();
                    }
                break;
                case REFUND:
                    refundRequested = TRUE; // deferred to after the loop
                break;

            }
        }
        else if (senderIsConstruct() == TRUE) {
            switch(currentTx.message[0]) {
                case DEDUCT_HITPOINTS:
                    if(isDead == FALSE) {
                        deductHitpoints(currentTx.message[1]);
                    }
                    break;
            }
       }
    }
    if(isDead == TRUE && deathPenaltyApplied == FALSE){
        handleDead();
    }
    if(isDead == FALSE) {
        checkLevelUp();
    }
    // Refund last: the whole activation's attacks/rerolls/effects have settled,
    // so this sends only the true remaining balance and can't strand a send.
    if(refundRequested == TRUE) {
        refund();
    }
}

void checkLevelUp() {
    if(xpTokenId == ZERO){ return; }
    // XP is a scarce, combat-minted, freely-tradable token (only constructs mint
    // it). Leveling on the held balance is intentional — it lets earned XP be
    // traded and lets a returning player move XP from their EOA into the
    // character. nextLevelXp only advances, so trading XP out never de-levels.
    long xp = getAssetBalance(xpTokenId);
    long leveledUp = FALSE;
    long i;
    for(i = 0; i < MAX_LEVELUPS_PER_ACTIVATION; ++i){
        if(xp < nextLevelXp){ break; }
        ++level;
        ++skillPoints;
        // Triangular curve: the gap to the next level grows linearly with the
        // level just reached (1000, +2000, +3000, ...), so higher levels cost
        // more without the exponential wall that doubling produced.
        nextLevelXp = nextLevelXp + LEVEL_XP_BASE * level;
        leveledUp = TRUE;
    }
    if(leveledUp == TRUE){
        messageBuffer[] = "Congrats, character leveled up";
        sendMessage(messageBuffer, getCreator());
    }
}

long senderIsConstruct() {
    long codehash = getExtMapValue(GAMEMASTER_MAP_KEY1_CONSTRUCT_HASH, ZERO, GAMEMASTER_REGISTRY);
    // An EOA's codehash is also 0, so an unset trusted hash must never match.
    if (codehash == ZERO) { return FALSE; }
    return getCodeHashOf(currentTx.sender) == codehash;
}

// Records an owner-action failure into the rolling error-log ring buffer and
// pushes a structured [marker, code, txId] message to the owner for immediate
// visibility. Only ever called from the creator's own action paths, so the
// last-ERROR_LOG_SIZE window can't be flooded by third parties.
void registerError(long code) {
    long slot = errorCount % ERROR_LOG_SIZE;
    setMapValue(MAP_KEY1_ERROR_CODE, slot, code);
    setMapValue(MAP_KEY1_ERROR_TXID, slot, currentTx.txId);
    ++errorCount;
    setMapValue(MAP_KEY1_ERROR_META, ZERO, errorCount);

    // Human-readable "ERROR Code: <code>" for the owner's wallet. SmartC has no
    // number-to-string, so the fixed label is a compile-time literal and the
    // ASCII digits are appended by hand. "ERROR Code: " is 12 bytes (chars are
    // packed 8/long, low byte first), so digit chars go at byte 12 = long[1]
    // byte 4 (<<32) and byte 13 = long[1] byte 5 (<<40). '0' is ASCII 48.
    messageBuffer[] = "ERROR Code: ";
    long tens = code / 10;
    long ones = code % 10;
    if(tens > ZERO){
        messageBuffer[1] = messageBuffer[1] | ((tens + 48) << 32) | ((ones + 48) << 40);
    } else {
        messageBuffer[1] = messageBuffer[1] | ((ones + 48) << 32);
    }
    sendShortMessage(messageBuffer, 2, getCreator()); // 2 longs = 16 bytes, fits "ERROR Code: NN"
}

void handleDead() {
    deathPenaltyApplied = TRUE;

    // when dead, drop a random skill point
    long i;
    long rnd;
    long attrValue;
    for(i=0; i< 10; ++i){ // try max ten times
        rnd = ((getWeakRandomNumber() >> 1) % FIVE) + 1;
        attrValue = getMapValue(MAP_KEY1_ATTRIBUTES, rnd);
        if(attrValue > ZERO){
            setMapValue(MAP_KEY1_ATTRIBUTES, rnd, attrValue - 1);
            break;
        }
    }

    // recalculate eventual attribute penalties
    recalculateDerivedStats();

    // Chance to drop ONE random held item (uniform over units) back to the
    // constructorAccount. Chance = DROP_BASE_CHANCE_PCT reduced by LUCK, floored
    // at 0 (see the #define). Equipment must be unequipped before it leaves so
    // its aggregate bonuses go with it. Inventory is otherwise left intact.
    if(usedInventorySlots > ZERO){
        long luck = getMapValue(MAP_KEY1_ATTRIBUTES, MAP_KEY2_ATTRIBUTES_LUCK);
        long dropChance = DROP_BASE_CHANCE_PCT - luck * LUCK_DROP_REDUCTION_PCT;
        if(dropChance > ZERO && ((getWeakRandomNumber() >> 1) % 100) < dropChance){
            long droppedToken = _inventoryDropRandom();
            long droppedType = getExtMapValue(droppedToken, GAMEMASTER_ITEM_KEY_TYPE, GAMEMASTER_REGISTRY);
            if(droppedType == ITEM_TYPE_EQUIPMENT){ applyAllEffects(droppedToken, -1); }
            sendQuantity(1, droppedToken, constructorAccount);
        }
    }

    messageBuffer[] = "Oh no, your character died!";
    sendMessage(messageBuffer, getCreator());
}

// Items are validated and accepted into inventory automatically on arrival
// (see receiveAssets()) — Equipment auto-applies its effects there and
// needs no further action. USE_ITEM is therefore only meaningful for an
// already-held Consumable: burn exactly 1 unit and apply its effect once.
void useItem(long tokenId) {
    if(getAssetBalance(tokenId) < 1){ registerError(ERR_USE_ITEM_NOT_HELD); return; }

    long itemType = getExtMapValue(tokenId, GAMEMASTER_ITEM_KEY_TYPE, GAMEMASTER_REGISTRY);
    if(itemType != ITEM_TYPE_CONSUMABLE){ registerError(ERR_USE_ITEM_NOT_CONSUMABLE); return; }

    long applied = applyAllEffects(tokenId, 1);
    if(applied <= ZERO){
        // Every effect's precondition failed (e.g. a HEAL potion used while
        // dead) — leave it untouched in inventory rather than destroying it.
        registerError(ERR_USE_ITEM_NO_EFFECT);
        return;
    }
    sendQuantity(1, tokenId, ZERO); // burn
    _inventoryRemoveOne(tokenId);
}

/**
 Filters eventually receiving assets.

 Slot 0 (the first asset) is handled by sender/context:
   - ATTACK (live owner): left untouched here — attack() forwards or refunds it
   - normal owner deposit: validated into inventory (registered item, level,
     stack, slot checks) — see receiveAsset() — but ONLY when it is the sole
     item in the transaction; if two or more items arrive together we cannot
     tell which was meant, so slot 0 is bounced along with the rest
   - anyone else: refunded in full, so a third party can't exhaust the inventory
     or force-apply equipment effects onto a character they don't own

 Slots 1-3 are never forwarded and never enter inventory: always refunded to the
 sender (this also covers the extra assets of a multi-asset ATTACK).

 The XP token is always passed straight through in every slot: it is freely
 tradable, never an inventory item (so it never counts as a second "item"
 either), and — on an ATTACK — is the asset attack() forwards to the construct.
 */
void receiveAssets(long senderIsOwner, long isAttack) {
    readAssets(currentTx.txId, currentTx.assetIds);

    // A non-XP asset in any later slot means 2+ items arrived in one tx — an
    // ambiguous deposit that is bounced wholesale (nothing enters inventory).
    long multiItem = (currentTx.assetIds[1] != ZERO && currentTx.assetIds[1] != xpTokenId)
                  || (currentTx.assetIds[2] != ZERO && currentTx.assetIds[2] != xpTokenId)
                  || (currentTx.assetIds[3] != ZERO && currentTx.assetIds[3] != xpTokenId);

    if(currentTx.assetIds[0] != ZERO && currentTx.assetIds[0] != xpTokenId && isAttack == FALSE){
        if(senderIsOwner == TRUE && multiItem == FALSE){
            receiveAsset(currentTx.assetIds[0]);
        }else{
            // Only the owner's own ambiguous deposit is logged; a stranger's
            // bounced asset stays silent so it can't flood the error log.
            if(senderIsOwner == TRUE){ registerError(ERR_DEPOSIT_AMBIGUOUS); }
            rejectAsset(currentTx.assetIds[0]);
        }
    }
    if(currentTx.assetIds[1] != ZERO && currentTx.assetIds[1] != xpTokenId){ rejectAsset(currentTx.assetIds[1]);  }
    if(currentTx.assetIds[2] != ZERO && currentTx.assetIds[2] != xpTokenId){ rejectAsset(currentTx.assetIds[2]);  }
    if(currentTx.assetIds[3] != ZERO && currentTx.assetIds[3] != xpTokenId){ rejectAsset(currentTx.assetIds[3]);  }
}

void rejectAsset(long tokenId){
    long quantity = getQuantity(currentTx.txId, tokenId);
    if(quantity > ZERO){
        sendQuantity(quantity, tokenId, currentTx.sender);
    }
}

// ---- INVENTORY SLOT INDEX ----
// The single accounting path for usedInventorySlots + the slot→tokenId index.
// Every deposit/burn/transfer/drop routes through these so held tokens, slots,
// and equip effects can never drift apart.

void _inventoryAdd(long tokenId, long count) {
    long i;
    for(i = 0; i < count; ++i){
        setMapValue(MAP_KEY1_INVENTORY, usedInventorySlots, tokenId);
        ++usedInventorySlots;
    }
}

// Frees one slot holding tokenId (swap-with-last compaction — slot order is
// irrelevant). No-op if none is held.
void _inventoryRemoveOne(long tokenId) {
    if(usedInventorySlots <= ZERO){ return; }
    long i;
    for(i = 0; i < usedInventorySlots; ++i){
        if(getMapValue(MAP_KEY1_INVENTORY, i) == tokenId){
            long last = usedInventorySlots - 1;
            setMapValue(MAP_KEY1_INVENTORY, i, getMapValue(MAP_KEY1_INVENTORY, last));
            setMapValue(MAP_KEY1_INVENTORY, last, ZERO);
            --usedInventorySlots;
            return;
        }
    }
}

// Removes one uniformly-random slot and returns its tokenId (ZERO if empty).
// Caller is responsible for unequipping/sending the returned unit.
long _inventoryDropRandom() {
    if(usedInventorySlots <= ZERO){ return ZERO; }
    long idx = (getWeakRandomNumber() >> 1) % usedInventorySlots;
    long tokenId = getMapValue(MAP_KEY1_INVENTORY, idx);
    long last = usedInventorySlots - 1;
    setMapValue(MAP_KEY1_INVENTORY, idx, getMapValue(MAP_KEY1_INVENTORY, last));
    setMapValue(MAP_KEY1_INVENTORY, last, ZERO);
    --usedInventorySlots;
    return tokenId;
}

void receiveAsset(long tokenId) {
    long incoming = getQuantity(currentTx.txId, tokenId);
    if(incoming <= ZERO){ return; }

    long itemType = getExtMapValue(tokenId, GAMEMASTER_ITEM_KEY_TYPE, GAMEMASTER_REGISTRY);
    if(itemType != ITEM_TYPE_EQUIPMENT && itemType != ITEM_TYPE_CONSUMABLE){
        sendQuantity(incoming, tokenId, currentTx.sender); // not a registered item — refund
        registerError(ERR_ITEM_NOT_REGISTERED);
        return;
    }

    // Equipment is one-per-slot: its effect is aggregated once per unit and
    // TRANSFER_ITEM unequips one unit per call, so a multi-unit stack would
    // desync slots/bonuses from holdings. Keep a single unit and refund the
    // surplus below — the player sees (incoming-1) come back and learns the rule.
    long accept = incoming;
    if(itemType == ITEM_TYPE_EQUIPMENT && incoming > 1){ accept = 1; }

    long minLevel = getExtMapValue(tokenId, GAMEMASTER_ITEM_KEY_MIN_LEVEL, GAMEMASTER_REGISTRY);
    if(level < minLevel){
        sendQuantity(incoming, tokenId, currentTx.sender);
        registerError(ERR_ITEM_LEVEL_TOO_LOW);
        return;
    }

    // priorHeld = balance before this tx's units arrived. Using it keeps the
    // stack check independent of whether the surplus refund below has settled.
    long priorHeld = getAssetBalance(tokenId) - incoming;
    long stackLimit = getExtMapValue(tokenId, GAMEMASTER_ITEM_KEY_STACK_LIMIT, GAMEMASTER_REGISTRY);
    if(stackLimit > ZERO && priorHeld + accept > stackLimit){
        sendQuantity(incoming, tokenId, currentTx.sender);
        registerError(ERR_ITEM_STACK_LIMIT);
        return;
    }

    if(usedInventorySlots + accept > maxInventorySlots){
        sendQuantity(incoming, tokenId, currentTx.sender);
        registerError(ERR_INVENTORY_FULL);
        return;
    }

    // Only now, once the kept unit is definitely accepted, refund the surplus
    // (avoids a double-refund if a check above had rejected the whole deposit).
    if(accept < incoming){
        sendQuantity(incoming - accept, tokenId, currentTx.sender);
        registerError(ERR_EQUIP_MULTI_UNIT);
    }

    _inventoryAdd(tokenId, accept);

    if(itemType == ITEM_TYPE_EQUIPMENT){
        applyAllEffects(tokenId, 1); // auto-equip on arrival
    }
    // Consumables are accepted but not applied here — see useItem().
}

// Returns how many of the item's effect slots actually changed state —
// callers use this to decide whether a consumable did anything before
// burning it (see useItem()).
long applyAllEffects(long tokenId, long sign) {
    long effectCount = getExtMapValue(tokenId, GAMEMASTER_ITEM_KEY_EFFECT_COUNT, GAMEMASTER_REGISTRY);
    long slot;
    long effectId;
    long appliedCount;
    appliedCount = ZERO;
    for(slot = 0; slot < effectCount; ++slot){
        effectId = getExtMapValue(tokenId, GAMEMASTER_ITEM_KEY_EFFECT_BASE + slot, GAMEMASTER_REGISTRY);
        if(effectId != ZERO){
            appliedCount += applyEffect(effectId, sign);
        }
    }
    return appliedCount;
}

// Returns 1 if the effect changed state, 0 if its precondition failed (e.g.
// HEAL while dead, REVIVE while alive) or its mode is unrecognized.
long applyEffect(long effectId, long sign) {
    long target   = getExtMapValue(effectId, GAMEMASTER_EFFECT_KEY_TARGET, GAMEMASTER_REGISTRY);
    long bonusAbs = getExtMapValue(effectId, GAMEMASTER_EFFECT_KEY_BONUS_ABS, GAMEMASTER_REGISTRY);
    long bonusRel = getExtMapValue(effectId, GAMEMASTER_EFFECT_KEY_BONUS_REL, GAMEMASTER_REGISTRY);
    long mode     = getExtMapValue(effectId, GAMEMASTER_EFFECT_KEY_MODE, GAMEMASTER_REGISTRY);
    long duration = getExtMapValue(effectId, GAMEMASTER_EFFECT_KEY_DURATION, GAMEMASTER_REGISTRY);
    long current;

    if(mode == MODE_AGGREGATE_ABS){
        current = getMapValue(MAP_KEY1_EQUIP_BONUS_ABS, target);
        setMapValue(MAP_KEY1_EQUIP_BONUS_ABS, target, current + sign * bonusAbs);
        return 1;
    } else if(mode == MODE_AGGREGATE_REL){
        current = getMapValue(MAP_KEY1_EQUIP_BONUS_REL, target);
        setMapValue(MAP_KEY1_EQUIP_BONUS_REL, target, current + sign * bonusRel);
        return 1;
    } else if(mode == MODE_HEAL){
        if(isDead == TRUE){ return ZERO; }
        // Flat amount plus a percentage of max HP; either field may be 0.
        currentHitpoints += bonusAbs + (maxHitpoints * bonusRel) / 100;
        if(currentHitpoints > maxHitpoints){ currentHitpoints = maxHitpoints; }
        return 1;
    } else if(mode == MODE_REVIVE){
        if(isDead == FALSE){ return ZERO; }
        isDead = FALSE;
        deathPenaltyApplied = FALSE; // must reset alongside isDead — see its declaration comment
        // Restore a flat amount PLUS a percentage of max HP; either field may be
        // 0, so one revive mode covers flat, percentage, and combined items.
        long restored = bonusAbs + (maxHitpoints * bonusRel) / 100;
        if(restored > maxHitpoints){ restored = maxHitpoints; }
        if(restored < 1){ restored = 1; } // never revive to 0 — that is just dead again
        currentHitpoints = restored;
        return 1;
    } else if(mode == MODE_STATUS_EFFECT){
        setMapValue(MAP_KEY1_STATUS_EFFECTS, target, getCurrentBlockheight() + duration);
        return 1;
    }
    return ZERO; // unknown mode — silently ignored (forward-compatible)
}

void allocateSkillPoint(long attrIndex) {
    if(attrIndex <= ZERO || attrIndex > FIVE){ registerError(ERR_ALLOC_INVALID_ATTRIBUTE); return; }
    if(skillPoints <= ZERO){ registerError(ERR_ALLOC_NO_SKILLPOINTS); return; }

    long currentAttributeValue = getMapValue(MAP_KEY1_ATTRIBUTES, attrIndex);
    setMapValue(MAP_KEY1_ATTRIBUTES, attrIndex, currentAttributeValue + 1);
    --skillPoints;

    // Carry over only the resulting HP delta (e.g. from a STAMINA point)
    // rather than a full heal — recalculateDerivedStats() alone would
    // otherwise leave currentHitpoints stale relative to the new max.
    long previousMaxHitpoints = maxHitpoints;
    recalculateDerivedStats();
    currentHitpoints += (maxHitpoints - previousMaxHitpoints);
}

// rawDamage is the construct's UNMITIGATED hit. The Character reduces it here
// from its own defensive attributes, so a construct is trusted for the raw
// value only and can never bypass mitigation or heal via a negative value.
void deductHitpoints(long rawDamage){
    if(rawDamage <= ZERO){ return; } // never heal / no-op on non-positive damage

    // Split into simple statements (one map read each) to stay within maxAuxVars.
    long dexterity = getMapValue(MAP_KEY1_ATTRIBUTES, MAP_KEY2_ATTRIBUTES_DEXTERITY);
    long luck = getMapValue(MAP_KEY1_ATTRIBUTES, MAP_KEY2_ATTRIBUTES_LUCK);
    long dodgeChance = (dexterity + luck) * DODGE_PCT_PER_POINT;
    if(dodgeChance > DODGE_MAX_PCT){ dodgeChance = DODGE_MAX_PCT; }

    long roll = (getWeakRandomNumber() >> 1) % 100;
    long net;
    if(roll < dodgeChance){
        net = ZERO; // dodged — the hit is avoided entirely
    } else {
        long stamina = getMapValue(MAP_KEY1_ATTRIBUTES, MAP_KEY2_ATTRIBUTES_STAMINA);
        net = rawDamage - stamina * ARMOR_PER_STAMINA;
        if(net < ZERO){ net = ZERO; } // armor fully absorbed the hit
    }

    currentHitpoints -= net;
    if(currentHitpoints <= ZERO){
        currentHitpoints = ZERO;
        isDead = TRUE;
    }
}

void refund() {
    sendAmount(getCurrentBalance(), getCreator());
}

void attack(long constructId) {
    long amount = getAmount(currentTx.txId);

    // Only the first asset is forwarded (contract API sends one asset per tx);
    // receiveAssets() already refunded slots 1-3 and passed slot 0 through
    // untouched for us to forward here.
    long firstAsset = currentTx.assetIds[0];
    long quantity = ZERO;
    if(firstAsset != ZERO){ quantity = getQuantity(currentTx.txId, firstAsset); }

    // The construct is an AT that only runs if paid at least its activation
    // amount. If the attached SIGNA can't cover that, the attack is impossible:
    // refund BOTH the SIGNA and the forwarded asset, and leave the character
    // uncommitted (so REROLL stays available). Slots 1-3 were refunded upstream.
    if(amount <= ZERO || amount < getActivationOf(constructId)){
        if(amount > ZERO){ sendAmount(amount, currentTx.sender); }
        if(firstAsset != ZERO && quantity > ZERO){
            sendQuantity(quantity, firstAsset, currentTx.sender);
        }
        registerError(ERR_ATTACK_NOT_POSSIBLE);
        return;
    }

    committed = TRUE;
    if(firstAsset != ZERO && quantity > ZERO){
        sendQuantityAndAmount(quantity, firstAsset, amount, constructId);
    }
    else {
        sendAmount(amount, constructId);
    }
}

void reroll() {
    if(committed == TRUE){ registerError(ERR_REROLL_COMMITTED); return; }
    if(rerollCount >= MAX_REROLLS){ registerError(ERR_REROLL_MAX_REACHED); return; }
    if(getCurrentBalance() < REROLL_COSTS){ registerError(ERR_REROLL_INSUFFICIENT); return; }
    ++rerollCount;

    setMapValue(MAP_KEY1_ATTRIBUTES, MAP_KEY2_ATTRIBUTES_STRENGTH, ZERO);
    setMapValue(MAP_KEY1_ATTRIBUTES, MAP_KEY2_ATTRIBUTES_STAMINA, ZERO);
    setMapValue(MAP_KEY1_ATTRIBUTES, MAP_KEY2_ATTRIBUTES_DEXTERITY, ZERO);
    setMapValue(MAP_KEY1_ATTRIBUTES, MAP_KEY2_ATTRIBUTES_LUCK, ZERO);
    setMapValue(MAP_KEY1_ATTRIBUTES, MAP_KEY2_ATTRIBUTES_WILLPOWER, ZERO);
    rollAttributes();
    currentHitpoints = maxHitpoints;
    sendAmount(REROLL_COSTS, ZERO);
}

void seppuku() {
    // Ritual suicide: the character dies outright. No SIGNA or assets are
    // sent back here — refund() remains separately available for that.
    currentHitpoints = ZERO;
    isDead = TRUE;

    messageBuffer[0] = CHAR_REGISTRY_M_UNREGISTER_CHARACTER;
    messageBuffer[1] = ZERO;
    messageBuffer[2] = ZERO;
    messageBuffer[3] = ZERO;
    sendAmountAndMessage(charRegistryActivationFee, messageBuffer, CHAR_REGISTRY);
}

void transferItem(long itemId, long recipientId) {
    // XP is bound to the character forever — it is earned/deposited one-way and
    // can never leave, so it can't be drained to level up another character.
    // (Trading happens EOA-side: attack a construct, receive XP, sell it.)
    if(itemId == xpTokenId) { registerError(ERR_TRANSFER_XP); return; }

    // EOA recipients only. Sending an item to another contract — a character in
    // particular — would occupy that contract's inventory slots and could be
    // abused to grief it, so reject any contract recipient outright before
    // touching state. getCodeHashOf() is non-zero only for contracts.
    if(getCodeHashOf(recipientId) != ZERO){ registerError(ERR_TRANSFER_TO_CONTRACT); return; }

    // Can't transfer what isn't held — guard before unequipping/decrementing.
    if(getAssetBalance(itemId) < 1){ registerError(ERR_TRANSFER_ITEM_NOT_HELD); return; }

    // Both equipment and consumables occupy one slot per held unit (credited in
    // receiveAsset); transferring one unit out must free one slot either way, or
    // consumables leak slots permanently. Equipment additionally holds live
    // aggregate bonuses, so unequip those before it leaves.
    long itemType = getExtMapValue(itemId, GAMEMASTER_ITEM_KEY_TYPE, GAMEMASTER_REGISTRY);
    if(itemType == ITEM_TYPE_EQUIPMENT || itemType == ITEM_TYPE_CONSUMABLE){
        if(itemType == ITEM_TYPE_EQUIPMENT){ applyAllEffects(itemId, -1); }
        _inventoryRemoveOne(itemId);
    }
    sendQuantity(1, itemId, recipientId);
}

