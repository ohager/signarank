#program name Construct
#program description This is the base contract to spawn Constructs
#program activationAmount 200000000
#pragma optimizationLevel 3
#pragma verboseAssembly false
#pragma maxAuxVars 3
// Hoist the most-used numeric literals (100, key ids, ...) into reusable const
// slots instead of re-emitting each immediate load. Purely a codegen/size win
// (semantics unchanged). 7 is the max before the compiler needs an 8th data page.
#pragma maxConstVars 7
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
#define SETATTACKERMODE 13
#define SETCHARACTERDAMAGE 14
#define SETEFFECTAFFINITY 15
#define SETDROPTOKEN 16
#define SETDROPMODIFIERS 17
#define SETLUCKFACTOR 18
#define SETCOUNTERDAMAGE 19
#define SETCOUNTEREFFECT 20

// The character contract's COMBAT method code — the construct SENDS this on a
// counter (must mirror character.contract's code): COMBAT(rawDamage, effectId,
// duration). effectId 0 = pure damage (== the character's DEDUCT_HITPOINTS).
#define CHAR_COMBAT 14

// ---- ITEM DROPS ----
// A bounded drop table of MAX_DROP_SLOTS entries. One D100 roll per character hit
// decides all slots at once (nested threshold bands). Drops go to the character
// only, supply-guarded by the construct's own balance.
#define MAX_DROP_SLOTS 5

// ---- CHARACTER PUBLIC PROFILE (read via getExtMapValue on the attacker) ----
// The character publishes its EFFECTIVE offensive stats (base attribute +
// equipment aggregate) to MAP_KEY1_COMBAT and its level to MAP_KEY1_PROGRESSION.
// The construct reads these — the weapon stays equipped on the character and is
// never attached/transferred. Mirror the character's public key layout.
#define CHAR_COMBAT_KEY1        4
#define CHAR_COMBAT_STRENGTH    1
#define CHAR_COMBAT_LUCK        2
#define CHAR_COMBAT_ATTACK_ABS  3
#define CHAR_COMBAT_ATTACK_REL  4
#define CHAR_COMBAT_ATTACK_EFFECT 5
#define CHAR_PROG_KEY1          3
#define CHAR_PROG_LEVEL         1

// ---- ATTACKER MODE (premium gating) ----
// Gamemaster-set gate checked right after character detection. A rejected
// attacker (wrong type for the mode) is refunded, not burned. CHARACTER_ONLY is
// the "premium" gate; the premium-ness comes from the config loaded behind it.
#define ATTACKER_MODE_ANY            0
#define ATTACKER_MODE_CHARACTER_ONLY 1
#define ATTACKER_MODE_EOA_ONLY       2

// helper
#define MAP_SET_FLAG 1024
#define TRANSFER_NFT_METHOD_HASH -8011735560658290665
#define NFT_FEES_PLANCK 32000000

// ---- GAMEMASTER REGISTRY (single source of truth) ----
// The construct sources the game's XP token from the registry (so it can never
// mint a mismatched token) and reads the trusted character codehashes live to
// recognise character-contract attackers. Keys mirror gamemaster-registry's G_*
// exactly. See docs/superpowers/specs/2026-07-15-construct-combat-design.md.
// FIXME: define per SIM/TESTNET/MAINNET
#define GAMEMASTER_REGISTRY 122344543654
#define REGISTRY_BASE 0x7FFFFFFFFFF00000
#define G_CHARACTER_HASH       (REGISTRY_BASE + 2)
#define G_XP_TOKEN             (REGISTRY_BASE + 3)
#define G_NEXT_CHARACTER_HASH  (REGISTRY_BASE + 6)

// Maps
#define MAP_DAMAGE_MULTIPLIER 1
#define MAP_DAMAGE_ADDITION 11
#define MAP_DAMAGE_TOKEN_LIMIT 12
#define MAP_ATTACKERS_LAST_ATTACK 2
#define MAP_ATTACKERS_DEBUFF 21
#define MAP_TOKEN_DECIMALS_INFO 3
// Creator-configured element affinity: map[effectId] = modifier% applied to a
// character attack whose element == effectId (>100 weakness, <100 resistance,
// unset/0 = neutral). Keyed by the character's published primary attack effect id.
#define MAP_EFFECT_AFFINITY 4

// parameters - starts at index 4 - initializable
// required
long name; // max 8 characters
long maxHp;

// optional
long baseDamageRatio;
long breachLimit;
long firstBloodBonus;
long finalBlowBonus;
long coolDownInBlocks;
long isActive;
long rewardNftId;

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
    const maxHp = TESTBED_maxHp;
    const breachLimit = TESTBED_breachLimit;
    const coolDownInBlocks = TESTBED_coolDownInBlocks;
    const firstBloodBonus = TESTBED_firstBloodBonus;
    const finalBlowBonus = TESTBED_finalBlowBonus;
    const isActive = TESTBED_isActive;
    const rewardNftId = TESTBED_rewardNftId;
#endif


// derived/calculated state - not intended for initialization
long isDefeated;
long firstBloodAccount;
long finalBlowAccount;
long hpTokenId;
long xpTokenId; // sourced from the gamemaster registry (G_XP_TOKEN) in init()
long totalDamageDealt;
long attackerMode; // gamemaster-set gate; defaults 0 = ATTACKER_MODE_ANY
long strDamageFactor; // character stat-damage tuning (per strength point)
long lvlDamageFactor; // character stat-damage tuning (per level)
// Drop table (parallel arrays, indexed by slot). tokenId 0 = empty slot.
long dropTokens[MAX_DROP_SLOTS];
long dropThresholds[MAX_DROP_SLOTS];
long dropQuantities[MAX_DROP_SLOTS];
long dropModNormal;    // effectiveRoll += this on a normal hit
long dropModFirstBlood;
long dropModFinalBlow;
long luckFactor;       // effectiveRoll -= luck × luckFactor
long counterDamageBase;     // base HP damage a countered character takes (0 = off)
long counterEffectId;       // registry effect applied on counter (0 = none)
long counterEffectDuration; // blocks the counter effect lasts

// basic tx iteration struct
struct TX {
    long txId;
    long sender;
    long height;
    long assetIds[4];
    long message[4];
} currentTx;

long messageBuffer[4];
long ZERO;
const ZERO = 0;

init();

void init(){

    // Single source of truth: the XP token comes from the gamemaster registry,
    // so a construct can never be deployed paying out a token characters won't
    // recognise. Read once at deploy (the registry must be configured first).
    xpTokenId = getExtMapValue(G_XP_TOKEN, ZERO, GAMEMASTER_REGISTRY);

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

    // Character stat-damage factors default to 1 per point; gamemaster-tunable
    // via SETCHARACTERDAMAGE (which may later set them to 0 to disable a term).
    if(strDamageFactor <= ZERO) {
        strDamageFactor = 1;
    }
    if(lvlDamageFactor <= ZERO) {
        lvlDamageFactor = 1;
    }

    // Drop-roll defaults (set unconditionally — init runs once at deploy; setters
    // may later assign any value including 0/negatives via SETDROPMODIFIERS).
    dropModNormal    = 15;
    dropModFirstBlood = 0;
    dropModFinalBlow = -15;
    luckFactor       = 1;

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

    long justMinted = ZERO;
    if(!isDefeated && hpTokenId != ZERO && getCurrentHitpoints() == ZERO) {
        mintAsset(maxHp, hpTokenId);
        justMinted = 1;
    }

    currentTx.height =  getCurrentBlockheight();

    while ((currentTx.txId = getNextTx()) != ZERO) {
        currentTx.sender = getSender(currentTx.txId);
        readMessage(currentTx.txId, 0, currentTx.message);
        readAssets(currentTx.txId, currentTx.assetIds);
        if(currentTx.sender != getCreator() && isDefeated==ZERO){

            if(isActive == 1 && justMinted == ZERO) {
                if(getAssetBalance(xpTokenId) < getCurrentHitpoints()){
                    // Can't cover the remaining HP with XP rewards — go dormant.
                    handleXpShortage();
                }else if(attackerAllowed()){
                    runAttackerRound();
                }else{
                    // wrong attacker type for the current mode — graceful refund
                    refundRejectedAttacker();
                }
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
                case SETATTACKERMODE:
                    setAttackerMode(currentTx.message[1]);
                break;
                case SETCHARACTERDAMAGE:
                    setCharacterDamage(currentTx.message[1], currentTx.message[2]);
                break;
                case SETEFFECTAFFINITY:
                    setEffectAffinity(currentTx.message[1], currentTx.message[2]);
                break;
                case SETDROPTOKEN:
                    setDropToken(currentTx.message[1], currentTx.message[2], currentTx.message[3]);
                break;
                case SETDROPMODIFIERS:
                    setDropModifiers(currentTx.message[1], currentTx.message[2], currentTx.message[3]);
                break;
                case SETLUCKFACTOR:
                    setLuckFactor(currentTx.message[1]);
                break;
                case SETCOUNTERDAMAGE:
                    setCounterDamage(currentTx.message[1]);
                break;
                case SETCOUNTEREFFECT:
                    setCounterEffect(currentTx.message[1], currentTx.message[2]);
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
    messageBuffer[] = "Construct not ready yet!";
    returnFundsAndAssets();
}

// The construct pays XP equal to the damage dealt; once its XP balance can no
// longer cover the remaining HP it can't reward attackers. It deactivates, warns
// the creator (who can refund/restock), and returns the current attacker's funds.
void handleXpShortage(){
    isActive = ZERO;
    messageBuffer[] = "XP Token Shortage";
    sendMessage(messageBuffer, getCreator());
    refund();
}

// Refund an attacker rejected by the current attacker mode (wrong type). Same
// graceful full-refund path as refund() — nothing is burned.
void refundRejectedAttacker(){
    messageBuffer[] = "Attacker type not allowed!";
    returnFundsAndAssets();
}

// Returns the full SIGNA plus any attached assets to the current sender, using
// whatever reason is already loaded in messageBuffer.
void returnFundsAndAssets(){
    sendAmountAndMessage(getAmount(currentTx.txId), messageBuffer, currentTx.sender);
    long i = 0;
    while(i < 4){
        long asset = currentTx.assetIds[i];
        if(asset != ZERO){
            sendQuantity(getQuantity(currentTx.txId, asset), asset, currentTx.sender);
        }
        ++i;
    }
}

// Attacker-mode gate. ANY lets everyone through; CHARACTER_ONLY / EOA_ONLY test
// the sender against the live character-codehash check.
long attackerAllowed(){
    if(attackerMode == ATTACKER_MODE_ANY){ return 1; }
    if(attackerMode == ATTACKER_MODE_CHARACTER_ONLY){ return senderIsCharacter(); }
    // ATTACKER_MODE_EOA_ONLY
    return !senderIsCharacter();
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

    // Characters use published-profile damage (no EOA power-up tokens except the
    // consumed element token); EOAs keep the per-token addition/multiplier
    // power-ups. Cached once — senderIsCharacter() does cross-contract reads and
    // also drives reward routing below.
    long isChar = senderIsCharacter();

    long totalDamage;
    if(isChar){
        totalDamage = calculateCharacterDamage(calculateSignaDamage());
    } else {
        totalDamage = applyTokenModifiers(calculateSignaDamage());
    }

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

    totalDamageDealt += effectiveDamage;

    // XP always goes to the attacker — a character levels on its OWN XP balance.
    if(effectiveDamage > ZERO){
        sendQuantity(effectiveDamage, xpTokenId, currentTx.sender);
    }
    // The hpToken damage-share receipt goes to the owner for a character (it would
    // reject an unregistered token), so the human holds it and joins the defeat
    // distribution. First/final-blood accounts store the owner for the same reason
    // (all SIGNA bonuses accrue to the human).
    long shareRecipient = currentTx.sender;
    if(isChar){
        shareRecipient = getCreatorOf(currentTx.sender);
    }
    sendQuantity(effectiveDamage, hpTokenId, shareRecipient);

    long gotFirstBlood = 0;
    if (firstBloodAccount == ZERO) {
        firstBloodAccount = shareRecipient;
        gotFirstBlood = 1;
        sendMsgFirstBlood(firstBloodAccount);
    }

    // Item drops: character-only, one luck-scaled D100 roll deciding all slots.
    if(isChar){
        rollItemDrops(isDefeated, gotFirstBlood);
    }

    if (breachLimitHit && !isDefeated) {
        sendMsgBreachLimit(currentTx.sender);
    }

    // Counter: shared chance model, but the effect differs by target. A character
    // takes real HP damage (DEDUCT_HITPOINTS); an EOA gets a future-damage debuff.
    if(isChar){
        if(counterDamageBase > ZERO && counterFires(preBreachDamage)){
            sendCharacterCounter();
        }
    } else if (shouldCounterAttack(preBreachDamage)) {
        executeCounterAttack();
    }

    // 8. Update Last Attack Block
    setMapValue(MAP_ATTACKERS_LAST_ATTACK, currentTx.sender, currentTx.height);
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

void refundPowerUpsWithPenalty() {
    long count = 0;
    long i = 0;
    while(i < 4){
        if(currentTx.assetIds[i] != ZERO){ count++; }
        ++i;
    }

    if (count <= 1) return;

    // Pick ONE random attached asset to keep as the cooldown penalty; refund the rest.
    long keepIndex = (getWeakRandomNumber() >> 1) % count;
    long currentIndex = 0;
    i = 0;
    while(i < 4){
        long asset = currentTx.assetIds[i];
        if(asset != ZERO){
            if(currentIndex != keepIndex){
                sendQuantity(getQuantity(currentTx.txId, asset), asset, currentTx.sender);
            }
            ++currentIndex;
        }
        ++i;
    }
}

// Character damage extends the SIGNA base with the character's published combat
// profile: a stat bonus (effective strength × strDamageFactor + level ×
// lvlDamageFactor) and the equipped weapon's attack bonus (flat abs summed in,
// then % rel scaling the total) — all read from the character's public map, so
// the weapon never leaves the character. The one attached asset is instead a
// consumable element token amplified EOA-style via applyTokenModifiers.
long calculateCharacterDamage(long base) {
    long strength = getExtMapValue(CHAR_COMBAT_KEY1, CHAR_COMBAT_STRENGTH, currentTx.sender);
    long level    = getExtMapValue(CHAR_PROG_KEY1,   CHAR_PROG_LEVEL,      currentTx.sender);
    long statBonus = strength * strDamageFactor + level * lvlDamageFactor;

    long attackAbs = getExtMapValue(CHAR_COMBAT_KEY1, CHAR_COMBAT_ATTACK_ABS, currentTx.sender);
    long attackRel = getExtMapValue(CHAR_COMBAT_KEY1, CHAR_COMBAT_ATTACK_REL, currentTx.sender);

    long raw = base + statBonus + attackAbs;
    raw = (raw * (100 + attackRel)) / 100;
    raw = applyTokenModifiers(raw);
    return applyElementAffinity(raw);
}

// Final multiplier: the construct's per-element affinity to the character's
// published attack element (weakness amplifies, resistance reduces). Unset (0)
// or no element (0) leaves damage unchanged.
long applyElementAffinity(long damage) {
    long effectId = getExtMapValue(CHAR_COMBAT_KEY1, CHAR_COMBAT_ATTACK_EFFECT, currentTx.sender);
    if(effectId == ZERO){ return damage; }
    long affinity = getMapValue(MAP_EFFECT_AFFINITY, effectId);
    if(affinity == ZERO){ return damage; } // unset = neutral (100%)
    return (damage * affinity) / 100;
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
    long i;

    // First pass: all flat additions; second pass: all multipliers.
    i = 0;
    while(i < 4){ damage += applyTokenAddition(currentTx.assetIds[i]); ++i; }
    i = 0;
    while(i < 4){ damage = applyTokenMultiplier(damage, currentTx.assetIds[i]); ++i; }

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

// The shared chance roll — fires with the breach-severity-scaled counter chance
// (calculateCounterAttackChance grows the chance the harder the hit exceeds the
// breach limit, capped at 90%).
long counterFires(long rawDamage) {
    if (debuff.chance <= ZERO) return 0;
    long dynamicChance = calculateCounterAttackChance(rawDamage);
    long random = (getWeakRandomNumber() >> 1) % 100;
    return (random < dynamicChance);
}

// EOA counter gate: needs a debuff magnitude AND the chance roll.
inline long shouldCounterAttack(long rawDamage) {
    if (debuff.damageReduction == 0) return 0;
    return counterFires(rawDamage);
}

// Sends DEDUCT_HITPOINTS to the character with its activation fee (so the message
// is picked up). The character applies its own dodge/armor mitigation and may die.
// Counter damage is the flat configured base — breach severity already scales the
// counter *chance* (calculateCounterAttackChance), so it is not double-applied to
// the magnitude here.
void sendCharacterCounter() {
    messageBuffer[0] = CHAR_COMBAT;
    messageBuffer[1] = counterDamageBase;
    messageBuffer[2] = counterEffectId;       // 0 = pure damage
    messageBuffer[3] = counterEffectDuration;
    sendAmountAndMessage(getActivationOf(currentTx.sender), messageBuffer, currentTx.sender);
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
    }
}

void handleDefeat() {
    // For a character final blow, the SIGNA victory bonus (and NFT trophy) accrue
    // to the owner EOA, not the character contract.
    finalBlowAccount = currentTx.sender;
    if(senderIsCharacter()){
        finalBlowAccount = getCreatorOf(currentTx.sender);
    }
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

    // Return any unused drop-token supply to the creator (gamemaster) who funded
    // it, rather than stranding it in the defeated construct.
    returnUnusedLoot();

    sendAmount(getCurrentBalance(), ZERO);
}

// ---- ONLY CREATOR CAN CALL THESE FUNCTIONS


// Returns each drop slot's leftover balance to the creator on defeat.
void returnUnusedLoot(){
    long slot = 0;
    while(slot < MAX_DROP_SLOTS){
        long token = dropTokens[slot];
        if(token != ZERO){
            long bal = getAssetBalance(token);
            if(bal > ZERO){
                sendQuantity(bal, token, getCreator());
            }
        }
        ++slot;
    }
}

void setActive(long active) {
    if(active != ZERO){
        active = 1;
    }
    isActive = active;
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

// True when the current tx's sender is a genuine character contract. Reads the
// trusted character codehashes LIVE from the registry so construct rotation /
// character migration windows are honoured. G_NEXT_CHARACTER_HASH is matched
// too, so v2 characters mid-migration aren't treated as EOAs. An EOA's codehash
// is 0 and never matches.
long senderIsCharacter(){
    long codehash = getCodeHashOf(currentTx.sender);
    if(codehash == ZERO){ return 0; }
    long trusted = getExtMapValue(G_CHARACTER_HASH, ZERO, GAMEMASTER_REGISTRY);
    if(trusted != ZERO && codehash == trusted){ return 1; }
    long trustedNext = getExtMapValue(G_NEXT_CHARACTER_HASH, ZERO, GAMEMASTER_REGISTRY);
    if(trustedNext != ZERO && codehash == trustedNext){ return 1; }
    return 0;
}

void setAttackerMode(long mode){
    // Ignore out-of-range values — leaves the mode unchanged (default ANY).
    if(mode == ATTACKER_MODE_ANY || mode == ATTACKER_MODE_CHARACTER_ONLY || mode == ATTACKER_MODE_EOA_ONLY){
        attackerMode = mode;
    }
}

void setCharacterDamage(long strFactor, long lvlFactor){
    // Non-negative factors only; 0 disables that term.
    if(strFactor >= ZERO){ strDamageFactor = strFactor; }
    if(lvlFactor >= ZERO){ lvlDamageFactor = lvlFactor; }
}

void setEffectAffinity(long effectId, long modifier){
    // modifier is a percentage: >100 weakness, <100 resistance, 100 neutral.
    // Stored 0 reads back as neutral, so 0 effectively clears an affinity.
    if(effectId != ZERO && modifier >= ZERO){
        setMapValue(MAP_EFFECT_AFFINITY, effectId, modifier);
    }
}

// slot + threshold are packed into one arg: packed = slot | (threshold << 8).
// tokenId 0 clears the slot.
void setDropToken(long packed, long tokenId, long quantity){
    long slot = packed & 0xFF;
    long threshold = packed >> 8;
    if(slot < MAX_DROP_SLOTS){
        dropTokens[slot] = tokenId;
        dropThresholds[slot] = threshold;
        dropQuantities[slot] = quantity;
    }
}

void setDropModifiers(long normal, long firstBlood, long finalBlow){
    dropModNormal = normal;
    dropModFirstBlood = firstBlood;
    dropModFinalBlow = finalBlow;
}

void setLuckFactor(long factor){
    if(factor >= ZERO){ luckFactor = factor; }
}

void setCounterDamage(long base){
    if(base >= ZERO){ counterDamageBase = base; }
}

// Timed debuff applied to a countered character (bundled into the COMBAT hit).
// effectId 0 = none (pure damage). duration in blocks.
void setCounterEffect(long effectId, long duration){
    if(effectId >= ZERO){ counterEffectId = effectId; }
    if(duration >= ZERO){ counterEffectDuration = duration; }
}

// One D100 roll (luck- and attack-type-scaled) decides every slot at once. For
// each configured slot, drop iff effectiveRoll < threshold, supply-guarded.
// Drops go to the character (the attacker).
void rollItemDrops(long isFinalBlow, long isFirstBlood){
    long modifier = dropModNormal;
    if(isFinalBlow){
        modifier = dropModFinalBlow;
    } else if(isFirstBlood){
        modifier = dropModFirstBlood;
    }

    long luck = getExtMapValue(CHAR_COMBAT_KEY1, CHAR_COMBAT_LUCK, currentTx.sender);
    long roll = (getWeakRandomNumber() >> 1) % 100;
    long effectiveRoll = roll + modifier - luck * luckFactor;

    long slot = 0;
    while(slot < MAX_DROP_SLOTS){
        long token = dropTokens[slot];
        long threshold = dropThresholds[slot];
        long qty = dropQuantities[slot];
        if(token != ZERO){
            if(effectiveRoll < threshold){
                if(getAssetBalance(token) >= qty){
                    sendQuantity(qty, token, currentTx.sender);
                }
            }
        }
        ++slot;
    }
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
