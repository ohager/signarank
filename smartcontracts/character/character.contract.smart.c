#program name Character
#program description Signarank Character Contract
#program activationAmount 100000000
#pragma optimizationLevel 2
#pragma verboseAssembly false
#pragma maxAuxVars 3
#pragma version 2.3.0

#define METHOD_ALLOCATE_SKILL 1

#define ATTR_STRENGTH  1
#define ATTR_STAMINA   2
#define ATTR_DEXTERITY 3
#define ATTR_LUCK      4
#define ATTR_WILLPOWER 5
#define ATTR_MAX_VALUE 6   // sentinel: valid indices are 1..5

#define DEFAULT_HP           100
#define DEFAULT_MAX_HP       100
#define DEFAULT_LEVEL        1

long hitpoints;
long maxHitpoints;
long level;
long maxInvSlots;
long itemRegistryId;
long xpTokenId;
long revivalTokenId;

struct Attrs {
    long strength;
    long stamina;
    long dexterity;
    long luck;
    long willpower;
} attrs;

// ---- Runtime state
long skillPoints;
long isDead;
long occupiedInvSlots;

long ZERO;
const ZERO = 0;
long TEN;
const TEN = 10;
long HP_PER_STAMINA;
const HP_PER_STAMINA = 10;

// ---- Testbed equivalent of createInitialDataStack
#ifdef TESTBED
    const hitpoints          = 100;
    const maxHitpoints       = DEFAULT_MAX_HP;
    const level       = DEFAULT_LEVEL;
    const charCreationPts = DEFAULT_CREATION_PTS;
    const maxInvSlots = DEFAULT_INV_SLOTS;
    const itemRegistryId  = TESTBED_itemRegistryId;
    const xpTokenId       = TESTBED_xpTokenId;
    const revivalTokenId  = TESTBED_revivalTokenId;
    const constructId     = TESTBED_constructId;
#endif

struct TX {
    long txId;
    long sender;
    long message[4];
} currentTx;

void init(){
    occupiedInvSlots = TEN;
    skillPoints = TEN;

    long creationCap = 5;
    long sumAttrs = attrs.strength + attrs.stamina + attrs.dexterity + attrs.luck + attrs.willpower;
    if (
        attrs.strength  > creationCap ||
        attrs.stamina   > creationCap ||
        attrs.dexterity > creationCap ||
        attrs.luck      > creationCap ||
        attrs.willpower > creationCap ||
        sumAttrs > TEN
    ) {
        // Cheat detected: distribute exactly skillPoints randomly,
        // each attribute gets 0..CREATION_CAP capped by points still available.
        long remaining = skillPoints;
        long toAssign;

        toAssign = (getWeakRandomNumber() >> 1) % (creationCap + 1);
        if (toAssign > remaining) { toAssign = remaining; }
        attrs.strength = toAssign;
        remaining -= toAssign;

        toAssign = (getWeakRandomNumber() >> 1) % (creationCap + 1);
        if (toAssign > remaining) { toAssign = remaining; }
        attrs.stamina = toAssign;
        remaining -= toAssign;

        toAssign = (getWeakRandomNumber() >> 1) % (creationCap + 1);
        if (toAssign > remaining) { toAssign = remaining; }
        attrs.dexterity = toAssign;
        remaining -= toAssign;

        toAssign = (getWeakRandomNumber() >> 1) % (creationCap + 1);
        if (toAssign > remaining) { toAssign = remaining; }
        attrs.luck = toAssign;
        remaining -= toAssign;

        // Willpower absorbs whatever is left, capped at CREATION_CAP.
        // Any overflow spills into charCreationPts so the 10-point budget is preserved.
        if (remaining > creationCap) {
            skillPoints = remaining - creationCap;
            attrs.willpower = creationCap;
        } else {
            skillPoints = ZERO;
            attrs.willpower = remaining;
        }
    } else {
        // Valid (or empty) pre-set: remaining creation points stay available.
        skillPoints = TEN - sumAttrs;
    }
    // Recalculate HP for any stamina already assigned.
    if (attrs.stamina > ZERO) {
        maxHitpoints += attrs.stamina * HP_PER_STAMINA;
        hitpoints = maxHitpoints;
    }
}

init();

void main() {
    while ((currentTx.txId = getNextTx()) != ZERO) {
        currentTx.sender = getSender(currentTx.txId);
        readMessage(currentTx.txId, 0, currentTx.message);

        if (currentTx.sender == getCreator()) {
            switch(currentTx.message[0]){
                case METHOD_ALLOCATE_SKILL:
                    allocateSkill();
                    break;
                }
        }
    }
}

void allocateSkill() {

    if(skillPoints == ZERO) { return; }

    switch(currentTx.message[1]){
        case ATTR_STRENGTH:
            attrs.strength += 1;
            break;
        case ATTR_STAMINA:
            attrs.stamina += 1;
            maxHitpoints += HP_PER_STAMINA;
            hitpoints    += HP_PER_STAMINA;
            break;
        case ATTR_DEXTERITY:
            attrs.dexterity += 1;
            break;
        case ATTR_LUCK:
            attrs.luck += 1;
            break;
        case ATTR_WILLPOWER:
            attrs.willpower += 1;
            break;
        default:
            return;
    }

    skillPoints -= 1;
}
