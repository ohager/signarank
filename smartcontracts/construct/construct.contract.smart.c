#program name Construct
#program description This is the base contract to spawn Constructs
#program activationAmount 200000000
#pragma optimizationLevel 2
#pragma verboseAssembly false
#pragma maxAuxVars 3
#pragma version 2.3.0

// Magic codes for methods
#define SETACTIVE 1
#define SETBREACHLIMIT 2
#define SETDAMAGEMULTIPLIER 3
#define SETDAMAGEADDITION 4
#define SETREWARDNFT 5
#define SETREWARDDISTRIBUTION 6
#define SETBONI 7
#define SETDEBUFF 8
#define SETREGENERATION 9
#define HEAL 10
#define SETTOKENDECIMALS 11
#define SETEVENTLISTENER 12

// helper
#define MAP_SET_FLAG 1024
#define TRANSFER_NFT_METHOD_HASH 7174296962751784077
#define NFT_FEES_PLANCK 32000000

// Maps
#define MAP_DAMAGE_MULTIPLIER 1
#define MAP_DAMAGE_ADDITION 11
#define MAP_DAMAGE_TOKEN_LIMIT 12
#define MAP_ATTACKERS_LAST_ATTACK 2
#define MAP_ATTACKERS_DEBUFF 21
#define MAP_TOKEN_DECIMALS_INFO 3

// parameters - starts at index 4 - initializable
// required
long name; // max 8 characters
long xpTokenId; // need to receive the amount of maxHp in XP Token.
long maxHp;

// optional
long baseDamageRatio;
long breachLimit;
long firstBloodBonus;
long finalBlowBonus;
long coolDownInBlocks;
long isActive;
long rewardNftId;
long eventListenerAccountId;

// Structs
struct REWARDDISTRIBUTION {
    long players;
    long treasury;
    // burn is implicit the rest
} rewardDistribution;

struct DEBUFF {
    long chance;
    long damageReduction;
    long maxStack;
} debuff;

struct REGENERATION {
    long blockInterval;
    long hitpoints;
    long lastRegenerationBlock;
} regeneration;

// Define initializer values if running on testbed
#ifdef TESTBED
    const name = TESTBED_name;
    const xpTokenId = TESTBED_xpTokenId;
    const maxHp = TESTBED_maxHp;
    const breachLimit = TESTBED_breachLimit;
    const coolDownInBlocks = TESTBED_coolDownInBlocks;
    const firstBloodBonus = TESTBED_firstBloodBonus;
    const finalBlowBonus = TESTBED_finalBlowBonus;
    const isActive = TESTBED_isActive;
    const rewardNftId = TESTBED_rewardNftId;
    const eventListenerAccountId = TESTBED_eventListenerAccountId;
#endif


// derived/calculated state - not intended for initialization
long isDefeated;
long firstBloodAccount;
long finalBlowAccount;
long hpTokenId;

// basic tx iteration struct
struct TX {
    long txId;
    long sender;
    long height;
    long assetIds[4];
    long message[4];
} currentTx;

long messageBuffer[4];
long eventBuffer[4];
long ZERO;
const ZERO = 0;

init();

void init(){

    hpTokenId = issueAsset(name, "", 0);

    // set defaults
    if(baseDamageRatio <= ZERO){
        baseDamageRatio = 10; // dmg(x) = x SIGNA * (10/100)
    }
    if(breachLimit <= ZERO){
        breachLimit = 20; // percentage: max damage is 20% initial HP
    }
    if(firstBloodBonus <= ZERO){
        firstBloodBonus = 1000_0000_0000;
    }

    if(finalBlowBonus <= ZERO) {
        finalBlowBonus = 5000_0000_0000;
    }

    if(coolDownInBlocks <= ZERO) {
        coolDownInBlocks = 15;
    }

    if(rewardDistribution.players <= ZERO){
        rewardDistribution.players = 85;
        rewardDistribution.treasury = 5;
        // rest is burn => 10%%
    }
    // debuff is optional... all zero is fine

    isActive = 1;
    isDefeated = 0;
}

void main() {

    if(hpTokenId != ZERO && getCurrentHitpoints() == ZERO) {
        mintAsset(maxHp, hpTokenId);
        return; // Let mint finalize before processing transactions
    }

    currentTx.height =  getCurrentBlockheight();
    if(isActive == 1 && getAssetBalance(xpTokenId) < getCurrentHitpoints()){
        messageBuffer[] = "XP Token Shortage";
        sendMessage(messageBuffer, getCreator());
        isActive = 0;
    }

    while ((currentTx.txId = getNextTx()) != ZERO) {
        currentTx.sender = getSender(currentTx.txId);
        readMessage(currentTx.txId, 0, currentTx.message);
        readAssets(currentTx.txId, currentTx.assetIds);
        if(currentTx.sender != getCreator() && isDefeated==ZERO){

            if(isActive == 1) {
                runAttackerRound();
            }else{
                refund();
            }
        }
        else if(currentTx.sender == getCreator()) {
            switch(currentTx.message[0]) {
                case SETACTIVE:
                    setActive(currentTx.message[1]);
                break;
                case SETBREACHLIMIT:
                    setBreachLimit(currentTx.message[1]);
                break;
                case SETDAMAGEMULTIPLIER:
                    setDamageMultiplier(currentTx.message[1], currentTx.message[2], currentTx.message[3]);
                break;
                case SETDAMAGEADDITION:
                    setDamageAddition(currentTx.message[1], currentTx.message[2], currentTx.message[3]);
                break;
                case SETREWARDNFT:
                    setRewardNft(currentTx.message[1]);
                break;
                case SETREWARDDISTRIBUTION:
                    setRewardDistribution(currentTx.message[1], currentTx.message[2]);
                break;
                case SETBONI:
                    setBoni(currentTx.message[1], currentTx.message[2]);
                break;
                case SETDEBUFF:
                    setDebuff(currentTx.message[1], currentTx.message[2], currentTx.message[3]);
                break;
                case SETREGENERATION:
                    setRegeneration(currentTx.message[1], currentTx.message[2]);
                break;
                case HEAL:
                    heal(currentTx.message[1]);
                break;
                case SETTOKENDECIMALS:
                    setTokenDecimals(currentTx.message[1], currentTx.message[2]);
                break;
                case SETEVENTLISTENER:
                    setEventListener(currentTx.message[1]);
                break;
            }
        }
    }

    if(isDefeated == 1) {
        handleDefeat();
    } else {
        regenerate();
    }
}

void refund(){
    messageBuffer[] = "Construct is not active!";
    sendAmountAndMessage(getAmount(currentTx.txId), messageBuffer, currentTx.sender);
    if(currentTx.assetIds[0] != ZERO){
        sendQuantity(getQuantity(currentTx.txId, currentTx.assetIds[0]), currentTx.assetIds[0], currentTx.sender);
    }
    if(currentTx.assetIds[1] != ZERO){
        sendQuantity(getQuantity(currentTx.txId, currentTx.assetIds[1]), currentTx.assetIds[1], currentTx.sender);
    }
    if(currentTx.assetIds[2] != ZERO){
        sendQuantity(getQuantity(currentTx.txId, currentTx.assetIds[2]), currentTx.assetIds[2], currentTx.sender);
    }
    if(currentTx.assetIds[3] != ZERO){
        sendQuantity(getQuantity(currentTx.txId, currentTx.assetIds[3]), currentTx.assetIds[3], currentTx.sender);
    }
}

void regenerate() {
    if(regeneration.blockInterval == ZERO || regeneration.hitpoints == ZERO) { return; }

    if(regeneration.lastRegenerationBlock == ZERO){
        regeneration.lastRegenerationBlock = currentTx.height;
        return;
    }

    long elapsedBlocks = currentTx.height - regeneration.lastRegenerationBlock;

    // Calculate regen proportional to time (fractional cycles)
    long hitpointsToRegenerate = (elapsedBlocks * regeneration.hitpoints) / regeneration.blockInterval;

    if(hitpointsToRegenerate > ZERO){
        long currentHp = getCurrentHitpoints();
        if(currentHp < maxHp){
            long actualRegen = hitpointsToRegenerate;
            if(currentHp + actualRegen > maxHp){
                actualRegen = maxHp - currentHp;
            }
            mintAsset(actualRegen, hpTokenId);
            sendEventHealed(actualRegen, 1);
        }
    }

    // Always update
    regeneration.lastRegenerationBlock = currentTx.height;
}


void runAttackerRound() {
    long breachLimitHit = 0;

    if (!checkCooldown()) {
        return;
    }

    long totalDamage = applyTokenModifiers(calculateSignaDamage());

    long debuffStacks = getMapValue(MAP_ATTACKERS_DEBUFF, currentTx.sender);
    if (debuffStacks > 0) {
        totalDamage = applyDebuff(totalDamage, debuffStacks);
        setMapValue(MAP_ATTACKERS_DEBUFF, currentTx.sender, debuffStacks - 1);
    }

    long preBreachDamage = totalDamage;
    long effectiveDamage = applyBreachLimit(totalDamage);
    if (effectiveDamage < preBreachDamage) {
        breachLimitHit = 1;
    }

    long currentHP = getCurrentHitpoints();
    if (effectiveDamage >= currentHP) {
        isDefeated = 1;
        effectiveDamage = currentHP; // we cannot do more damage
    }

    if(getAssetBalance(xpTokenId) < effectiveDamage){
        messageBuffer[] = "Insufficient XP Tokens!";
        sendMessage(messageBuffer, getCreator());
    }
    sendQuantity(effectiveDamage, xpTokenId, currentTx.sender);
    sendQuantity(effectiveDamage, hpTokenId, currentTx.sender);

    if (firstBloodAccount == ZERO) {
        firstBloodAccount = currentTx.sender;
        sendMsgFirstBlood(firstBloodAccount);
    }

    if (breachLimitHit && !isDefeated) {
        sendMsgBreachLimit(currentTx.sender);
    }

    if (shouldCounterAttack(preBreachDamage)) {
        executeCounterAttack();
    }

    // 8. Update Last Attack Block
    setMapValue(MAP_ATTACKERS_LAST_ATTACK, currentTx.sender, currentTx.height);

    if(!isDefeated){
        // if is defeated a another event is sent... avoid stacked message sending
        sendEventHit(effectiveDamage, currentHP);
    }
}

long checkCooldown() {
    long lastAttack = getMapValue(MAP_ATTACKERS_LAST_ATTACK, currentTx.sender);
    if (lastAttack > ZERO && (currentTx.height - lastAttack) < coolDownInBlocks) {
        sendMsgCooldown(currentTx.sender);
        // Still in cooldown! Refund 90%, burn 10%
        long signaAmount = getAmount(currentTx.txId);
        long refundAmount = (signaAmount * 90) / 100;
        long burnAmount = signaAmount - refundAmount;

        // Refund SIGNA
        if (refundAmount > ZERO) {
            sendAmount(refundAmount, currentTx.sender);
        }

        // Burn
        if (burnAmount > ZERO) {
            sendAmount(burnAmount, ZERO); // Burn address
        }

        refundPowerUpsWithPenalty();
        return 0; // Failed cooldown check
    }

    return 1; // Passed
}

inline void refundPowerUpsWithPenalty() {
    long count = 0;

    // using unrolled loops for efficiency

    if(currentTx.assetIds[0] != ZERO) { count++; }
    if(currentTx.assetIds[1] != ZERO) { count++; }
    if(currentTx.assetIds[2] != ZERO) { count++; }
    if(currentTx.assetIds[3] != ZERO) { count++; }

    if (count == 0) return;
    if (count == 1) return;

    // Pick ONE random to keep (penalty)
    // the other
    long keepIndex = (getWeakRandomNumber() >> 1) % count;
    long currentIndex = 0;

    if(currentTx.assetIds[0] != ZERO && currentIndex++ != keepIndex) {
        sendQuantity(getQuantity(currentTx.txId, currentTx.assetIds[0]), currentTx.assetIds[0], currentTx.sender);
    }

    if(currentTx.assetIds[1] != ZERO && currentIndex++ != keepIndex) {
        sendQuantity(getQuantity(currentTx.txId, currentTx.assetIds[1]), currentTx.assetIds[1], currentTx.sender);
    }

    if(currentTx.assetIds[2] != ZERO && currentIndex++ != keepIndex) {
        sendQuantity(getQuantity(currentTx.txId, currentTx.assetIds[2]), currentTx.assetIds[2], currentTx.sender);
    }

    if(currentTx.assetIds[3] != ZERO && currentIndex++ != keepIndex) {
        sendQuantity(getQuantity(currentTx.txId, currentTx.assetIds[3]), currentTx.assetIds[3], currentTx.sender);
    }

}

inline long calculateSignaDamage() {
     //  1. long signa =getAmount(currentTx.txId) / 1_0000_0000;
     //  2. (signa * baseDamageRatio) / 100;
     // optimized:
    return (getAmount(currentTx.txId) * baseDamageRatio) / 100_0000_0000;
}


long applyDebuff(long damage, long stacks) {
    if (stacks <= ZERO) return damage;

    // Cap to current maxStack (technically maxStack can change during game)
    if (debuff.maxStack > ZERO && stacks > debuff.maxStack) {
        stacks = debuff.maxStack;
    }
    // Calculate total reduction
    long totalReduction = stacks * debuff.damageReduction;

    // Apply reduction (can be negative = buff!)
    long modifiedDamage = (damage * (100 - totalReduction)) / 100;

    // Ensure non-negative
    if (modifiedDamage < ZERO) modifiedDamage = 0;

    return modifiedDamage;
}

long applyTokenModifiers(long baseDamage) {
    long damage = baseDamage;
    long totalAddition = 0;

    // First pass: Apply all flat additions
    totalAddition += applyTokenAddition(currentTx.assetIds[0]);
    totalAddition += applyTokenAddition(currentTx.assetIds[1]);
    totalAddition += applyTokenAddition(currentTx.assetIds[2]);
    totalAddition += applyTokenAddition(currentTx.assetIds[3]);

    damage += totalAddition;

    // Second pass: Apply all multipliers
    damage = applyTokenMultiplier(damage, currentTx.assetIds[0]);
    damage = applyTokenMultiplier(damage, currentTx.assetIds[1]);
    damage = applyTokenMultiplier(damage, currentTx.assetIds[2]);
    damage = applyTokenMultiplier(damage, currentTx.assetIds[3]);

    return damage;
}

long applyTokenAddition(long tokenId) {
    long quantity = getQuantity(currentTx.txId, tokenId);
    if (quantity == ZERO) { return 0; }

    long addition = getMapValue(MAP_DAMAGE_ADDITION, tokenId);
    if (addition == ZERO) { return 0; }

    long tokenLimit = getMapValue(MAP_DAMAGE_TOKEN_LIMIT, tokenId);
    long decimals = getTokenDecimals(tokenId, 0); // 0 means: do not send message

    // Apply token limit (convert to raw units with decimals)
    if (tokenLimit > ZERO) {
        long tokenLimitRaw = tokenLimit * pow10(decimals);
        if (quantity > tokenLimitRaw) {
            quantity = tokenLimitRaw;
        }
    }

    // Apply addition (stacks per token, supports fractional tokens)
    // Example: 2 tokens × 50 addition = 100 damage added
    // Example: 0.5 tokens × 50 addition = 25 damage added
    return (addition * quantity) / pow10(decimals);
}


long applyTokenMultiplier(long damage, long tokenId) {
  long quantity = getQuantity(currentTx.txId, tokenId);
  if (quantity == ZERO) { return damage; }

  long multiplier = getMapValue(MAP_DAMAGE_MULTIPLIER, tokenId);
  if (multiplier == ZERO) { return damage; }

  long tokenLimit = getMapValue(MAP_DAMAGE_TOKEN_LIMIT, tokenId);
  long decimals = getTokenDecimals(tokenId, 0);

  // Apply token limit (convert to raw units with decimals)
  if (tokenLimit > ZERO) {
      long tokenLimitRaw = tokenLimit * pow10(decimals);
      if (quantity > tokenLimitRaw) {
          quantity = tokenLimitRaw;
      }
  }

  // Handle resistance tokens (< 100) multiplicatively, buffs linearly
  if (multiplier < 100) {
      // Resistance: Apply each token individually (exponential stacking)
      long quantityInt = quantity / pow10(decimals);
      long i = 0;
      while (i < quantityInt) {
          damage = (damage * multiplier) / 100;
          i = i + 1;
      }

      // Handle fractional part (if decimals > 0)
      long fractional = quantity % pow10(decimals);
      if (fractional > ZERO) {
          // Linear interpolation for fractional tokens
          // Example: 0.5 tokens × 94 = (100 + 94)/2 = 97 effective multiplier
          long fractionalMultiplier = 100 - (((100 - multiplier) * fractional) / pow10(decimals));
          damage = (damage * fractionalMultiplier) / 100;
      }

      return damage;
  } else {
      // Buff tokens: Linear stacking (existing behavior)
      return ((damage * multiplier) / 100 * quantity) / pow10(decimals);
  }
}

// Helper function - optimized for decimals 0-6
long pow10(long exp) {
    switch(exp) {
        case 0: return 1;
        case 1: return 10;
        case 2: return 100;
        case 3: return 1000;
        case 4: return 10000;
        case 5: return 100000;
        case 6: return 1000000;
        default: return 1; // Should never happen since decimals are capped at 6
    }
}

long applyBreachLimit(long damage) {
    if (breachLimit <= ZERO) {
        return damage;
    }

    long maxDamage = (maxHp * breachLimit) / 100;
    if (damage > maxDamage) {
        return maxDamage;
    }

    return damage;
}

inline long shouldCounterAttack(long rawDamage) {
    if (debuff.chance <= ZERO || debuff.damageReduction == 0) return 0;

    long dynamicChance = calculateCounterAttackChance(rawDamage);

    long random = getWeakRandomNumber() % 100;
    return (random < dynamicChance);
}

inline long calculateCounterAttackChance(long rawDamage) {
    // If no breach limit, use base chance
    if (breachLimit <= ZERO) {
      return debuff.chance;
    }

    long breachLimitDamage = (maxHp * breachLimit) / 100;
    if(rawDamage <= breachLimitDamage){
        return debuff.chance;
    }
    // the higher the rawDamage (exceeding breachLimitDamage) the higher the chance of debuffing
    long scaledChance = (debuff.chance * rawDamage) / breachLimitDamage;
    if (scaledChance > 90) {
      scaledChance = 90;
    }
    return scaledChance;
}

void executeCounterAttack() {
    long currentStacks = getMapValue(MAP_ATTACKERS_DEBUFF, currentTx.sender);

    // Cap existing stacks if admin lowered maxStack in the meanwhile
    if (currentStacks > debuff.maxStack) {
        currentStacks = debuff.maxStack;
        setMapValue(MAP_ATTACKERS_DEBUFF, currentTx.sender, currentStacks);
    }

    if (currentStacks < debuff.maxStack) {
        setMapValue(MAP_ATTACKERS_DEBUFF, currentTx.sender, currentStacks + 1);
        if(debuff.damageReduction < ZERO){
            sendMsgCounterBuff(currentTx.sender);
        }else{
            sendMsgCounterDebuff(currentTx.sender);
        }
        sendEventCounterAttacked();
    }
}

void handleDefeat() {
    finalBlowAccount = currentTx.sender;
    sendMsgDefeated(getCreator());
    sendMsgVictory(finalBlowAccount);
    sendAmount(finalBlowBonus, finalBlowAccount);
    messageBuffer[] = "First Blood Bonus";
    sendAmountAndMessage(firstBloodBonus, messageBuffer, firstBloodAccount);

    // Send NFT if configured
    if (rewardNftId != ZERO) {
        messageBuffer[0] = TRANSFER_NFT_METHOD_HASH;
        messageBuffer[1] = finalBlowAccount;
        messageBuffer[2] = ZERO;
        messageBuffer[3] = ZERO;
        sendAmountAndMessage(NFT_FEES_PLANCK, messageBuffer, rewardNftId);
    }


    // Distribute Rewards
    long totalSigna = getCurrentBalance();
    long treasuryShare = (totalSigna * rewardDistribution.treasury) / 100;
    if (treasuryShare > ZERO) {
        sendAmount(treasuryShare, getCreator());
    }

    long playersCount = getAssetHoldersCount(1, hpTokenId);
    long distributionCosts = playersCount * 10_0000;
    long playersShare = ((totalSigna * rewardDistribution.players) / 100) - distributionCosts;
    distributeToHolders(1, hpTokenId, playersShare, 0, 0);

    sendEventDefeated(); // before we burn all amount

    sendAmount(getCurrentBalance(), ZERO);
}

// ---- ONLY CREATOR CAN CALL THESE FUNCTIONS


void setActive(long active) {
    if(active != ZERO){
        active = 1;
    }
    isActive = active;
    sendEventActiveToggled();
}

void setBreachLimit(long limit) {
    if(limit > ZERO && limit <= 100){
        breachLimit = limit;
    }
}

void setDamageMultiplier(long tokenId, long multiplier, long tokenLimit) {
    // validate for registered token sends message on token decimals
    getTokenDecimals(tokenId, 1);

    if(multiplier > ZERO && multiplier <= 1000) { // max 10x damage
        setMapValue(MAP_DAMAGE_MULTIPLIER, tokenId, multiplier);
    }

    if(tokenLimit >= ZERO) {
        setMapValue(MAP_DAMAGE_TOKEN_LIMIT, tokenId, tokenLimit);
    }
}

void setDamageAddition(long tokenId, long damageAddition, long tokenLimit) {
    // validate for registered token sends message on token decimals
    getTokenDecimals(tokenId, 1);

    if(damageAddition > ZERO) {
       setMapValue(MAP_DAMAGE_ADDITION, tokenId, damageAddition);
    }

    if(tokenLimit >= ZERO) {
        setMapValue(MAP_DAMAGE_TOKEN_LIMIT, tokenId, tokenLimit);
    }
}

void setRewardNft(long nftId) {
    long nftCreator = getCreatorOf(nftId);
    if(getCreatorOf(nftId) == ZERO){
        messageBuffer[] = "Nft does not exist";
        sendMessage(messageBuffer, getCreator());
        return;
    }
    rewardNftId = nftId;
}

void setRewardDistribution(long players, long treasury) {
    if(players < ZERO) return;
    if(treasury < ZERO) return;
    if(players + treasury <= 100){
        rewardDistribution.players = players;
        rewardDistribution.treasury = treasury;
    }
}

void setBoni(long firstBloodAmount, long finalBlowAmount) {
    if(firstBloodAmount >= ZERO){
        firstBloodBonus = firstBloodAmount;
    }
    if(finalBlowAmount >= ZERO){
        finalBlowBonus = finalBlowAmount;
    }
}


void setDebuff(long debuffChance, long damageReduction, long maxDebuffStack) {
    if(debuffChance >= ZERO) {
        debuff.chance = debuffChance;
    }

    // damage reduction can be negative...which is a buffing then!
    debuff.damageReduction = damageReduction;

    if(maxDebuffStack >= ZERO){
        debuff.maxStack = maxDebuffStack;
    }

}

void setRegeneration(long blockInterval, long hitpoints){
    if(blockInterval >= ZERO) {
        regeneration.blockInterval = blockInterval;
    }
    if(hitpoints >= ZERO && hitpoints <= maxHp) {
        regeneration.hitpoints = hitpoints;
    }
}

void heal(long hitpoints){

    if(hitpoints <= ZERO) { return; }

    long actualHealing = hitpoints;
    long currentHitpoints = getCurrentHitpoints();
    if(hitpoints + currentHitpoints > maxHp){
        actualHealing = maxHp - currentHitpoints;
    }

    mintAsset(actualHealing, hpTokenId);
    sendMsgHealer(getCreator());
    sendEventHealed(actualHealing, 0);
}

void setTokenDecimals(long tokenId, long tokenDecimals){
    if(tokenDecimals >= ZERO && tokenDecimals <= 6){
        // the getMapValue return 0 also for non registered tokens, but 0 can be a valid decimal value
        // we need to flag a set value, as we cannot rely solely on the value
        setMapValue(MAP_TOKEN_DECIMALS_INFO, tokenId, tokenDecimals + MAP_SET_FLAG);
    }
}

long getTokenDecimals(long tokenId, long shouldSendMessage){
    long tokenDecimals = getMapValue(MAP_TOKEN_DECIMALS_INFO, tokenId);
    if(tokenDecimals >= MAP_SET_FLAG){
        // Return only the decimal value (subtract the flag)
        return tokenDecimals - MAP_SET_FLAG;
    }
    if(shouldSendMessage != ZERO){
        messageBuffer[] = "Unregistered Token detected!";
        sendMessage(messageBuffer, getCreator());
    }
    return 0;
}

long getCurrentHitpoints(){
    return getAssetBalance(hpTokenId);
}

void setEventListener(long accountId){
    eventListenerAccountId = accountId;
}

// ----- MESSAGE HELPERS


void sendMsgCooldown(long recipient) {
    messageBuffer[] = "COOLDOWN! Attack too soon!";
    sendShortMessage(messageBuffer, 4, recipient);
}

void sendMsgFirstBlood(long recipient) {
    messageBuffer[] = "FIRST BLOOD! Bonus on defeat!";
    sendShortMessage(messageBuffer, 4, recipient);
}

void sendMsgVictory(long recipient) {
    messageBuffer[] = "VICTORY! Final blow bonus!";
    sendShortMessage(messageBuffer, 4, recipient);
}

void sendMsgCounterDebuff(long recipient) {
    messageBuffer[] = "COUNTER! Damage reduced.";
    sendShortMessage(messageBuffer, 4, recipient);
}

void sendMsgCounterBuff(long recipient) {
    messageBuffer[] = "BERSERK! Damage increased.";
    sendShortMessage(messageBuffer, 4, recipient);
}

void sendMsgBreachLimit(long recipient) {
    messageBuffer[] = "BREACH! Armor absorbed damage!";
    sendShortMessage(messageBuffer, 4, recipient);
}

void sendMsgHealer(long recipient) {
    messageBuffer[] = "HEALING: Construct recovered!";
    sendShortMessage(messageBuffer, 4, recipient);
}

void sendMsgDefeated(long recipient) {
    messageBuffer[] = "DEFEATED!";
    sendShortMessage(messageBuffer, 2, recipient);
}

//  SEND EVENT HELPERS
inline void sendEventActiveToggled(){
    eventBuffer[0]=600;
    eventBuffer[1]=isActive;
    eventBuffer[2]=ZERO;
    eventBuffer[3]=ZERO;
    sendEvent(eventBuffer);
}

inline void sendEventHit(long damage, long currentHitpoints){
    eventBuffer[0]=601;
    eventBuffer[1]=currentTx.sender;
    eventBuffer[2]=damage;
    eventBuffer[3]=currentHitpoints - damage;
    sendEvent(eventBuffer);
}

inline void sendEventHealed(long healed, long isRegenerated){
    eventBuffer[0]=602;
    if(isRegenerated) {
        eventBuffer[1]=ZERO;
    } else {
        eventBuffer[1]=currentTx.sender;
    }
    eventBuffer[2]=healed;
    eventBuffer[3]=getCurrentHitpoints() + healed;
    sendEvent(eventBuffer);
}

inline void sendEventCounterAttacked(){
    eventBuffer[0]=603;
    eventBuffer[1]=currentTx.sender;
    eventBuffer[2]=ZERO;
    eventBuffer[3]=ZERO;
    sendEvent(eventBuffer);
}

inline void sendEventDefeated(){
    eventBuffer[0]=666;
    eventBuffer[1]=finalBlowAccount;
    eventBuffer[2]=ZERO;
    eventBuffer[3]=ZERO;
    sendEvent(eventBuffer);
}

void sendEvent(long * buffer){
    // send only when exists, and not caused by listener themself
    if(eventListenerAccountId != ZERO && currentTx.sender != eventListenerAccountId){
        sendMessage(buffer, eventListenerAccountId);
    }
}
