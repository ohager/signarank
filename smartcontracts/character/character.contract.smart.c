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

// Must mirror gamemaster-registry.contract.smart.c's REGISTRY_BASE exactly —
// that contract stores Globals (incl. the trusted construct hash) at
// REGISTRY_BASE.., and Items below it. Using a different key here silently
// desyncs senderIsConstruct() from whatever the gamemaster actually configures.
#define REGISTRY_BASE 0x7FFFFFFFFFF00000
#define GAMEMASTER_MAP_KEY1_ITEMS 1
#define GAMEMASTER_MAP_KEY1_CONSTRUCT_HASH (REGISTRY_BASE + 1)
#define GAMEMASTER_MAP_KEY2_CHARACTER_HASH 3

// Magic codes for methods - Player Methods
#define ALLOCATE_SKILLPOINT 1
#define ATTACK 2
#define TRANSFER_ITEM 4
#define USE_ITEM 5
#define REVIVE 6
#define REFUND 99

// Construct Methods
#define DEDUCT_HITPOINTS 13


// Maps - accessible by other contracts
#define MAP_KEY1_ATTRIBUTES 1
#define MAP_KEY2_ATTRIBUTES_STRENGTH    1
#define MAP_KEY2_ATTRIBUTES_STAMINA     2
#define MAP_KEY2_ATTRIBUTES_DEXTERITY   3
#define MAP_KEY2_ATTRIBUTES_LUCK        4
#define MAP_KEY2_ATTRIBUTES_WILLPOWER   5


#define MAP_KEY1_INVENTORY 2
#define MAP_KEY2_INVENTORY_COUNT 0
// items are registered globally

// Initializable

long constructorAccount; // the creator of constructs
long revivalTokenId;     // native Signum token; owner sends 1 to revive a dead Character

#ifdef TESTBED
    const constructorAccount = TESTBED_constructorAccount;
    const revivalTokenId = TESTBED_revivalTokenId;
#endif


// State variables
long currentHitpoints;
long maxHitpoints;
long isDead;
// Guards handleDead() so its random attribute penalty applies exactly once
// per death. Reset to FALSE by revive() alongside isDead.
long deathPenaltyApplied;
long skillPoints;
long usedInventorySlots;
long maxInventorySlots;

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


void init() {

    // create random attributes
    skillPoints = FIVE;
    long index;
    long attrValue;
    while(skillPoints > ZERO){
        index = ((getWeakRandomNumber() >> 1) % FIVE) + 1;
        attrValue = getMapValue(MAP_KEY1_ATTRIBUTES, index);
        setMapValue(MAP_KEY1_ATTRIBUTES, index, attrValue + 1);
        --skillPoints;
    };

    maxHitpoints = 100 + (getMapValue(MAP_KEY1_ATTRIBUTES, MAP_KEY2_ATTRIBUTES_STAMINA) * HP_PER_STAMINA);
    currentHitpoints = maxHitpoints;
    maxInventorySlots = 10 + ((getMapValue(MAP_KEY1_ATTRIBUTES, MAP_KEY2_ATTRIBUTES_STRENGTH)));
    usedInventorySlots = ZERO;
    isDead = FALSE;
}

init();

// Structs

// basic tx iteration struct
struct TX {
    long txId;
    long sender;
    long message[4];
} currentTx;

void main() {
    while ((currentTx.txId = getNextTx()) != 0) {
        currentTx.sender = getSender(currentTx.txId);
        readMessage(currentTx.txId, 0, currentTx.message);

        if(currentTx.sender == getCreator()){ // is player
            switch(currentTx.message[0]) {
                case ALLOCATE_SKILLPOINT:
                    allocateSkillPoint(currentTx.message[1]);
                break;
                case ATTACK:
                    attack(currentTx.message[1], currentTx.message[2], currentTx.message[3]);
                break;
                case TRANSFER_ITEM:
                    transferItem(currentTx.message[1], currentTx.message[2]);
                    break;
                case REVIVE:
                    revive();
                break;
                case REFUND:
                    refund(currentTx.message[1]);
                break;

            }
        }
        else if (senderIsConstruct() == TRUE) {
            switch(currentTx.message[0]) {
                case DEDUCT_HITPOINTS:
                    deductHitpoints(currentTx.message[1]);
                    break;
            }
       }
    }
    if(isDead == TRUE && deathPenaltyApplied == FALSE){
        handleDead();
    }
}

long senderIsConstruct() {
    long codehash = getExtMapValue(GAMEMASTER_MAP_KEY1_CONSTRUCT_HASH, ZERO, GAMEMASTER_REGISTRY);
    // An EOA's codehash is also 0, so an unset trusted hash must never match.
    if (codehash == ZERO) { return FALSE; }
    return getCodeHashOf(currentTx.sender) == codehash;
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
    maxHitpoints = 100 + (getMapValue(MAP_KEY1_ATTRIBUTES, MAP_KEY2_ATTRIBUTES_STAMINA) * HP_PER_STAMINA);
    maxInventorySlots = 10 + ((getMapValue(MAP_KEY1_ATTRIBUTES, MAP_KEY2_ATTRIBUTES_STRENGTH)));

    // TODO: eventually drop an item (randomly)
    if(maxInventorySlots < usedInventorySlots){
        usedInventorySlots = maxInventorySlots;
    }

}

void revive() {
    // getAssetBalance() is live and slot-independent, so this recognizes the
    // token whether it arrived in this transaction or an earlier one.
    // revivalTokenId != ZERO guards against an unconfigured (0) token id.
    if(isDead == TRUE && revivalTokenId != ZERO && getAssetBalance(revivalTokenId) >= 1){
        isDead = FALSE;
        deathPenaltyApplied = FALSE; // must reset alongside isDead — see its declaration comment
        currentHitpoints = maxHitpoints / 2; // restore half of the hitpoints
        sendQuantity(1, revivalTokenId, ZERO);
    }
}

void allocateSkillPoint(long attrIndex) {
    if(skillPoints > ZERO && attrIndex > ZERO && attrIndex <= FIVE ) {
        long currentAttributeValue = getMapValue(MAP_KEY1_ATTRIBUTES, attrIndex);
        setMapValue(MAP_KEY1_ATTRIBUTES, attrIndex, currentAttributeValue + 1);
        --skillPoints;
    }
}

void deductHitpoints(long hitpoints){
    currentHitpoints -= hitpoints;
    if(currentHitpoints <= ZERO){
        currentHitpoints = ZERO;
        isDead = TRUE;
    }
}

void refund(long assetId) {
    if(assetId == ZERO){
        sendAmount(getCurrentBalance(), getCreator());
    } else {
        sendQuantity(getAssetBalance(assetId), assetId, getCreator());
    }
}

void attack(long constructId, long quantity, long assetId) {
    long amount = getAmount(currentTx.txId);
    if(isDead == TRUE){
        if(amount >= ZERO){ sendAmount(amount, currentTx.sender); }
        return;
    }
    if(quantity > ZERO && amount >= ZERO) {
        sendQuantityAndAmount(quantity, assetId, amount, constructId);
    } else if (amount >= ZERO) {
        sendAmount(amount, constructId);
    }
}

void transferItem(long itemId, long recipientId) {
    sendQuantity(1, itemId, recipientId);
}

