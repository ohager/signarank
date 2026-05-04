#program name Character
#program description Signarank Character Contract
#program activationAmount 100000000
#pragma optimizationLevel 2
#pragma verboseAssembly false
#pragma maxAuxVars 3
#pragma version 2.3.0

#define METHOD_ALLOCATE_SKILL 1

#define ATTR_STRENGTH  0
#define ATTR_STAMINA   1
#define ATTR_DEXTERITY 2
#define ATTR_LUCK      3
#define ATTR_WILLPOWER 4
#define ATTR_COUNT     5

long itemRegistryId;
long xpTokenId;
long revivalTokenId;

/*
0 - strength
1 - stamina
2 - dexterity
3 - luck
4 - willpower
*/
long attrs[5];

// ---- Runtime state
long skillpoints;
long hitpoints;
long maxHitpoints;
long level;
long maxInvSlots;
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
    maxInvSlots = TEN;
    skillpoints = TEN;

    long creationCap = 5;
    long sumAttrs = attrs[0] + attrs[1] + attrs[2] + attrs[3] + attrs[4];
    long cheat = ZERO;
    long i;
    if(sumAttrs <= TEN) {
        for (i = 0; i < ATTR_COUNT; i++) {
            if (attrs[i] > creationCap) { cheat = 1; break; }
        }
    } else {
        cheat = 1;
    }

    if (cheat != ZERO) {
        // Cheat detected: reset all attrs and redistribute 10 points one-by-one
        // to random slots (respecting the creation cap). Uniform and unpredictable.
        attrs[0] = ZERO;
        attrs[1] = ZERO;
        attrs[2] = ZERO;
        attrs[3] = ZERO;
        attrs[4] = ZERO;
        long idx;
        while (skillpoints > ZERO) {
            idx = (getWeakRandomNumber() >> 1) % ATTR_COUNT;
            if (attrs[idx] < creationCap) {
                attrs[idx] += 1;
                skillpoints -= 1;
            }
        }
    } else {
        skillpoints = TEN - sumAttrs;
    }

    // Adjust HP for any stamina already assigned.
    if (attrs[ATTR_STAMINA] > ZERO) {
        maxHitpoints += attrs[ATTR_STAMINA] * HP_PER_STAMINA;
    }
    hitpoints = maxHitpoints;
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
    if (skillpoints == ZERO) { return; }
    long attrIndex = currentTx.message[1];
    if (attrIndex >= ATTR_COUNT) { return; }
    attrs[attrIndex] += 1;
    if (attrIndex == ATTR_STAMINA) {
        maxHitpoints += HP_PER_STAMINA;
        hitpoints    += HP_PER_STAMINA;
    }
    skillpoints -= 1;
}
