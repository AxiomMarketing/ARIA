# Design Patterns Reference for ARIA Implementations

Reference: https://refactoring.guru/design-patterns/typescript

This document maps all 22 GoF design patterns to ARIA spec structures with TypeScript implementation guidance. Use this when reviewing or implementing code generated from ARIA specs.

---

## CREATIONAL PATTERNS — How objects are created

### 1. Factory Method

**Intent:** Define an interface for creating objects, let subclasses decide which class to instantiate.

**ARIA trigger:** Enum type with many variants that each produce different objects.

```aria
type RoleId is Enum
  voyante, sorciere, chasseur, loup_garou, cupidon
```

**TypeScript implementation:**
```typescript
interface Role {
  id: RoleId;
  performNightAction(game: GameState): ActionResult;
}

// Factory Method — each role type creates its own handler
function createRole(id: RoleId): Role {
  const factories: Record<RoleId, () => Role> = {
    voyante: () => new Voyante(),
    sorciere: () => new Sorciere(),
    chasseur: () => new Chasseur(),
    loup_garou: () => new LoupGarou(),
    cupidon: () => new Cupidon(),
  };
  return factories[id]();
}
```

**When to use:** Every time an ARIA Enum drives object creation. If the spec has `dispatch on role`, the dispatch sub-contracts naturally become factory products.

**When NOT to use:** If the Enum is just data (status flags, categories) with no behavior attached.

---

### 2. Abstract Factory

**Intent:** Produce families of related objects without specifying their concrete classes.

**ARIA trigger:** Multiple related Record types that vary together (e.g., UI themes, platform-specific implementations).

```aria
type GameConfig is Record
  rules: RuleSet
  ui: UIConfig
  audio: AudioConfig
```

**TypeScript implementation:**
```typescript
interface GameFactory {
  createRules(): RuleSet;
  createUI(): UIConfig;
  createAudio(): AudioConfig;
}

class ClassicGameFactory implements GameFactory {
  createRules() { return new ClassicRules(); }
  createUI() { return new ClassicUI(); }
  createAudio() { return new ClassicAudio(); }
}

class ExtendedGameFactory implements GameFactory {
  createRules() { return new ExtendedRules(); }
  createUI() { return new ExtendedUI(); }
  createAudio() { return new ExtendedAudio(); }
}
```

**When to use:** When the spec defines multiple Record types that must be consistent with each other (same "family"). Changing one requires changing all.

**When NOT to use:** If the types are independent — just use individual Factory Methods.

---

### 3. Builder

**Intent:** Construct complex objects step by step. Same construction process can create different representations.

**ARIA trigger:** Record with many fields, especially with computed fields and optional fields.

```aria
type GameConfig is Record
  playerCount: Integer
  roles: List of RoleId
  nightDuration: Integer
  dayDuration: Integer
  hasVoyante: Boolean computed as contains(roles, voyante)
  complexity: Complexity
```

**TypeScript implementation:**
```typescript
class GameConfigBuilder {
  private config: Partial<GameConfig> = {};

  withPlayers(count: number): this {
    this.config.playerCount = count;
    return this;
  }

  withRoles(roles: RoleId[]): this {
    this.config.roles = roles;
    this.config.hasVoyante = roles.includes('voyante');
    return this;
  }

  withTimings(night: number, day: number): this {
    this.config.nightDuration = night;
    this.config.dayDuration = day;
    return this;
  }

  build(): GameConfig {
    // Validate with Zod schema
    return GameConfigSchema.parse(this.config);
  }
}

// Usage
const config = new GameConfigBuilder()
  .withPlayers(8)
  .withRoles(['voyante', 'sorciere', 'loup_garou', 'loup_garou'])
  .withTimings(30, 120)
  .build();
```

**When to use:** Records with 5+ fields, especially when some are computed or optional. Also useful when the same data needs to be constructed from different sources (API, file, user input).

**When NOT to use:** Simple Records with 2-3 required fields — just use the constructor directly.

---

### 4. Prototype

**Intent:** Create new objects by copying existing ones.

**ARIA trigger:** Types imported from shared-types.aria that are used as templates.

```aria
import Player from "./shared-types.aria"

contract ClonePlayer
  inputs
    source: Player
  ensures
    result.id != source.id
    result.role == source.role
```

**TypeScript implementation:**
```typescript
interface Cloneable<T> {
  clone(): T;
}

class Player implements Cloneable<Player> {
  constructor(
    public readonly id: string,
    public readonly role: RoleId,
    public isAlive: boolean,
  ) {}

  clone(): Player {
    return new Player(
      crypto.randomUUID(), // new ID
      this.role,           // same role
      this.isAlive,        // same state
    );
  }
}
```

**When to use:** When the spec has contracts that create modified copies of existing objects (game snapshots, player state backups, template duplication).

**When NOT to use:** If objects are always created fresh — use Factory Method instead.

---

### 5. Singleton

**Intent:** Ensure a class has only one instance, provide global access to it.

**ARIA trigger:** Contract with `depends_on` pointing to a single service.

```aria
contract StartGame
  depends_on GameEngine
  inputs
    config: GameConfig
  ensures
    result.gameId exists
```

**TypeScript implementation:**
```typescript
class GameEngine {
  private static instance: GameEngine | null = null;
  private games = new Map<string, GameState>();

  private constructor() {} // prevent direct construction

  static getInstance(): GameEngine {
    if (!GameEngine.instance) {
      GameEngine.instance = new GameEngine();
    }
    return GameEngine.instance;
  }

  startGame(config: GameConfig): { gameId: string } {
    const id = crypto.randomUUID();
    this.games.set(id, createInitialState(config));
    return { gameId: id };
  }
}
```

**When to use:** Services declared in `depends_on` that should have exactly one instance (database connections, event buses, game engine).

**When NOT to use:** Most cases. Singleton is overused. Prefer dependency injection. Only use when the spec explicitly requires a single shared instance.

**Better alternative:** Dependency injection via constructor parameters, which is more testable.

---

## STRUCTURAL PATTERNS — How objects compose

### 6. Adapter

**Intent:** Convert the interface of one class into another interface clients expect.

**ARIA trigger:** Contract with `depends_on` for an external service (Stripe, database, WebSocket).

```aria
contract ChargePayment
  depends_on StripeAPI
  inputs
    amount: Money
    method: PaymentMethod
  ensures
    result.transactionId exists
```

**TypeScript implementation:**
```typescript
// External API has its own interface
interface StripeCharge {
  create(params: { amount_cents: number; source: string }): Promise<{ id: string }>;
}

// Our domain interface (from ARIA spec)
interface PaymentGateway {
  charge(amount: Money, method: PaymentMethod): Promise<{ transactionId: string }>;
}

// Adapter bridges the two
class StripeAdapter implements PaymentGateway {
  constructor(private stripe: StripeCharge) {}

  async charge(amount: Money, method: PaymentMethod): Promise<{ transactionId: string }> {
    const result = await this.stripe.create({
      amount_cents: amount,
      source: this.mapMethod(method),
    });
    return { transactionId: result.id };
  }

  private mapMethod(method: PaymentMethod): string {
    // Map ARIA enum to Stripe's expected values
    const mapping: Record<PaymentMethod, string> = {
      card: 'tok_card', bank: 'tok_bank', wallet: 'tok_wallet',
    };
    return mapping[method];
  }
}
```

**When to use:** Every `depends_on` external service. The adapter isolates your domain types (from `.types.ts`) from the third-party API, making it testable with mocks.

**When NOT to use:** Internal services that already use your domain types.

---

### 7. Bridge

**Intent:** Separate an abstraction from its implementation so both can vary independently.

**ARIA trigger:** Generic types `Result of T, E` where the abstraction (Result) is separate from what it contains.

```aria
type Result of T, E is Record
  success: Boolean
  data: T
  error: E
```

**TypeScript implementation:**
```typescript
// Abstraction — the "what"
interface GameAction<TInput, TResult> {
  validate(input: TInput): boolean;
  execute(input: TInput): Promise<TResult>;
}

// Implementation — the "how"
interface ActionExecutor {
  run<T>(action: () => Promise<T>): Promise<T>;
}

// Concrete implementations vary independently
class LocalExecutor implements ActionExecutor {
  async run<T>(action: () => Promise<T>): Promise<T> {
    return action();
  }
}

class QueuedExecutor implements ActionExecutor {
  async run<T>(action: () => Promise<T>): Promise<T> {
    await this.queue.add(action);
    return action();
  }
}

// Bridge: action doesn't know HOW it's executed
class VoyanteAction implements GameAction<VoyanteInput, VoyanteResult> {
  constructor(private executor: ActionExecutor) {}

  async execute(input: VoyanteInput): Promise<VoyanteResult> {
    return this.executor.run(() => this.doVision(input));
  }
}
```

**When to use:** When you need to swap the execution strategy (local vs queued vs remote) without changing the business logic. Common with generic ARIA types.

**When NOT to use:** If there's only one way to execute — keep it simple.

---

### 8. Composite

**Intent:** Compose objects into tree structures, treat individual and composite objects uniformly.

**ARIA trigger:** Nested Record types (Record containing List of Records).

```aria
type GameState is Record
  players: List of Player
  teams: List of Team

type Team is Record
  camp: Camp
  members: List of Player
```

**TypeScript implementation:**
```typescript
interface GameComponent {
  getAlivePlayers(): Player[];
  getPlayerCount(): number;
}

class PlayerLeaf implements GameComponent {
  constructor(private player: Player) {}
  getAlivePlayers() { return this.player.isAlive ? [this.player] : []; }
  getPlayerCount() { return 1; }
}

class TeamComposite implements GameComponent {
  private members: GameComponent[] = [];

  add(member: GameComponent) { this.members.push(member); }

  getAlivePlayers(): Player[] {
    return this.members.flatMap(m => m.getAlivePlayers());
  }

  getPlayerCount(): number {
    return this.members.reduce((sum, m) => sum + m.getPlayerCount(), 0);
  }
}
```

**When to use:** Hierarchical game structures (teams > players, zones > areas > cells, permission trees).

**When NOT to use:** Flat lists — just use array methods.

---

### 9. Decorator

**Intent:** Attach additional behavior to objects dynamically, without modifying them.

**ARIA trigger:** Contract with `rate_limit`, `timeout`, `retry` — these are decorators on the base contract.

```aria
contract VoyanteVision
  rate_limit max 1 per night
  timeout 30 seconds
  retry max 2 backoff exponential
  inputs
    targetId: PlayerId
  ensures
    result.revealedRole exists
```

**TypeScript implementation:**
```typescript
// Base contract interface
interface ContractFn<TInput, TResult> {
  (input: TInput): Promise<TResult>;
}

// Decorators wrap the base function
function withTimeout<I, R>(fn: ContractFn<I, R>, ms: number): ContractFn<I, R> {
  return async (input) => {
    const result = await Promise.race([
      fn(input),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
      ),
    ]);
    return result;
  };
}

function withRetry<I, R>(fn: ContractFn<I, R>, max: number, backoff: 'exponential' | 'linear'): ContractFn<I, R> {
  return async (input) => {
    for (let attempt = 0; attempt < max; attempt++) {
      try { return await fn(input); }
      catch (e) {
        if (attempt === max - 1) throw e;
        const delay = backoff === 'exponential' ? 2 ** attempt * 100 : attempt * 100;
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw new Error('Unreachable');
  };
}

function withRateLimit<I, R>(fn: ContractFn<I, R>, max: number, perKey: (input: I) => string): ContractFn<I, R> {
  const counts = new Map<string, number>();
  return async (input) => {
    const key = perKey(input);
    const current = counts.get(key) ?? 0;
    if (current >= max) throw new Error(`Rate limit exceeded for ${key}`);
    counts.set(key, current + 1);
    return fn(input);
  };
}

// Compose decorators — order matters (outer runs first)
const voyanteVision = withRateLimit(
  withTimeout(
    withRetry(baseVoyanteVision, 2, 'exponential'),
    30_000
  ),
  1,
  (input) => `night-${input.nightNumber}`
);
```

**When to use:** Every time the spec has `rate_limit`, `timeout`, or `retry`. Also for logging, caching, auth checks.

**When NOT to use:** If the behavior is intrinsic to the contract (not cross-cutting).

---

### 10. Facade

**Intent:** Provide a simplified interface to a complex subsystem.

**ARIA trigger:** Module with many contracts that clients call through one entry point.

```aria
-- game-engine.aria has 15 contracts, but clients just need:
contract StartGame
contract PerformAction
contract EndTurn
```

**TypeScript implementation:**
```typescript
// Complex subsystem
class PhaseManager { /* ... */ }
class VoteSystem { /* ... */ }
class RoleResolver { /* ... */ }
class DeathProcessor { /* ... */ }

// Facade — simple API for the complex subsystem
class GameFacade {
  private phases = new PhaseManager();
  private votes = new VoteSystem();
  private roles = new RoleResolver();
  private deaths = new DeathProcessor();

  async startGame(config: GameConfig): Promise<GameState> {
    const roles = this.roles.assign(config);
    const state = this.phases.initialize(config, roles);
    return state;
  }

  async performAction(gameId: string, action: GameAction): Promise<ActionResult> {
    const state = await this.getState(gameId);
    const role = this.roles.resolve(action.playerId, state);
    const result = role.performAction(action, state);
    if (result.deaths.length > 0) {
      this.deaths.process(result.deaths, state);
    }
    return result;
  }

  async endTurn(gameId: string): Promise<PhaseTransition> {
    return this.phases.advance(gameId);
  }
}
```

**When to use:** Modules with 5+ contracts where external consumers only need 2-3 entry points. The facade hides the internal orchestration.

**When NOT to use:** Simple modules with 1-2 contracts — the module itself is already simple enough.

---

### 11. Flyweight

**Intent:** Share common state across many objects to save memory.

**ARIA trigger:** Small Enum or Record types used in hundreds of instances.

```aria
type RoleDef is Record
  id: RoleId
  camp: Camp
  nightOrder: Integer
  complexity: Complexity
```

**TypeScript implementation:**
```typescript
// Flyweight — shared, immutable role definitions
const ROLE_DEFS: ReadonlyMap<RoleId, Readonly<RoleDef>> = new Map([
  ['voyante', { id: 'voyante', camp: 'village', nightOrder: 2, complexity: 'simple' }],
  ['sorciere', { id: 'sorciere', camp: 'village', nightOrder: 3, complexity: 'medium' }],
  ['loup_garou', { id: 'loup_garou', camp: 'loups', nightOrder: 1, complexity: 'simple' }],
  // ... 30+ roles share these immutable definitions
]);

// Player has extrinsic state (alive, votes) + flyweight reference
class Player {
  constructor(
    public readonly id: string,
    private readonly roleDef: Readonly<RoleDef>, // shared flyweight
    public isAlive: boolean = true,              // unique per player
  ) {}

  get camp() { return this.roleDef.camp; }
  get nightOrder() { return this.roleDef.nightOrder; }
}
```

**When to use:** Static definitions (roles, cards, rules, config presets) referenced by many instances. Use `as const` and `Readonly<>` in TypeScript.

**When NOT to use:** Objects that are unique per instance.

---

### 12. Proxy

**Intent:** Provide a substitute that controls access to the original object.

**ARIA trigger:** Contract with `requires` checks before the actual logic.

```aria
contract PerformAction
  requires
    player.isAlive == true
    game.phase == "night"
    player.role == "voyante"
  ensures
    result.success == true
```

**TypeScript implementation:**
```typescript
// Validation Proxy — checks requires before delegating
class ActionProxy implements GameAction {
  constructor(private realAction: GameAction) {}

  async execute(input: ActionInput): Promise<ActionResult> {
    // Requires checks (from spec)
    if (!input.player.isAlive) {
      throw new DeadPlayerError(input.player.id);
    }
    if (input.game.phase !== 'night') {
      throw new WrongPhaseError(input.game.phase);
    }

    // Delegate to real implementation
    return this.realAction.execute(input);
  }
}

// Logging Proxy
class LoggingProxy implements GameAction {
  constructor(private realAction: GameAction, private logger: Logger) {}

  async execute(input: ActionInput): Promise<ActionResult> {
    this.logger.info(`Action started: ${input.action}`);
    const result = await this.realAction.execute(input);
    this.logger.info(`Action completed: ${result.success}`);
    return result;
  }
}

// Compose: logging wraps validation wraps real
const action = new LoggingProxy(
  new ActionProxy(new RealVoyanteAction()),
  logger
);
```

**When to use:** Every contract with `requires` — the proxy enforces preconditions. Also for lazy loading, caching, access control.

**When NOT to use:** If the validation is trivial (1 check) — inline it.

---

## BEHAVIORAL PATTERNS — How objects communicate

### 13. Chain of Responsibility

**Intent:** Pass a request along a chain of handlers until one handles it.

**ARIA trigger:** Contract with multiple ordered `requires` checks.

```aria
contract JoinGame
  requires
    game.status == "lobby"
    game.players.length < game.maxPlayers
    player.id not in game.players
    player.isBanned == false
```

**TypeScript implementation:**
```typescript
interface ValidationHandler {
  setNext(handler: ValidationHandler): ValidationHandler;
  validate(input: JoinGameInput): ValidationResult;
}

abstract class BaseValidator implements ValidationHandler {
  private next?: ValidationHandler;

  setNext(handler: ValidationHandler): ValidationHandler {
    this.next = handler;
    return handler; // enable chaining
  }

  validate(input: JoinGameInput): ValidationResult {
    if (this.next) return this.next.validate(input);
    return { valid: true };
  }
}

class GameStatusCheck extends BaseValidator {
  validate(input: JoinGameInput): ValidationResult {
    if (input.game.status !== 'lobby') {
      return { valid: false, error: 'Game is not in lobby' };
    }
    return super.validate(input);
  }
}

class PlayerCapCheck extends BaseValidator {
  validate(input: JoinGameInput): ValidationResult {
    if (input.game.players.length >= input.game.maxPlayers) {
      return { valid: false, error: 'Game is full' };
    }
    return super.validate(input);
  }
}

// Build the chain
const validator = new GameStatusCheck();
validator
  .setNext(new PlayerCapCheck())
  .setNext(new DuplicatePlayerCheck())
  .setNext(new BanCheck());
```

**When to use:** 3+ sequential `requires` checks where each can short-circuit independently. Also for middleware pipelines (auth → rate limit → validate → execute).

**When NOT to use:** 1-2 simple checks — just use if/else.

---

### 14. Command

**Intent:** Encapsulate a request as an object, enabling undo, queue, and logging.

**ARIA trigger:** Saga with `steps` + `compensate`.

```aria
contract PlaceOrder
  steps
    step validate -> ValidateStock
    step charge -> ChargePayment
    step ship -> CreateShipment
  compensate
    charge -> RefundPayment
    ship -> CancelShipment
```

**TypeScript implementation:**
```typescript
interface Command {
  execute(): Promise<void>;
  undo(): Promise<void>;
}

class ChargePaymentCommand implements Command {
  private transactionId?: string;

  constructor(private amount: Money, private gateway: PaymentGateway) {}

  async execute() {
    const result = await this.gateway.charge(this.amount);
    this.transactionId = result.transactionId;
  }

  async undo() {
    if (this.transactionId) {
      await this.gateway.refund(this.transactionId);
    }
  }
}

// Saga executor — runs commands in order, compensates on failure
class SagaExecutor {
  private executed: Command[] = [];

  async run(commands: Command[]): Promise<void> {
    for (const cmd of commands) {
      try {
        await cmd.execute();
        this.executed.push(cmd);
      } catch (error) {
        // Compensate in reverse order
        for (const done of this.executed.reverse()) {
          await done.undo();
        }
        throw error;
      }
    }
  }
}
```

**When to use:** Every `steps` + `compensate` spec. Also for game action history (undo last move), queued operations, and audit logging.

**When NOT to use:** Single-step operations with no need for undo.

---

### 15. Iterator

**Intent:** Traverse a collection without exposing its underlying structure.

**ARIA trigger:** Contracts that process List types.

```aria
type PlayerList is List of Player
  where length(self) > 0

contract ProcessNightActions
  inputs
    players: PlayerList
  ensures
    every player in result.processed has player.actionResolved == true
```

**TypeScript implementation:**
```typescript
// Custom iterator for night action processing (ordered by role priority)
class NightActionIterator implements Iterable<Player> {
  constructor(private players: Player[]) {}

  *[Symbol.iterator](): Iterator<Player> {
    const sorted = [...this.players]
      .filter(p => p.isAlive && p.hasNightAction)
      .sort((a, b) => ROLE_DEFS.get(a.role)!.nightOrder - ROLE_DEFS.get(b.role)!.nightOrder);

    for (const player of sorted) {
      yield player;
    }
  }
}

// Usage — doesn't know about sorting/filtering internals
for (const player of new NightActionIterator(game.players)) {
  await processNightAction(player, game);
}
```

**When to use:** Collections that need custom traversal order (night action priority, vote counting order, phase progression). The iterator encapsulates the ordering logic.

**When NOT to use:** Simple arrays where `.map()` / `.filter()` suffice.

---

### 16. Mediator

**Intent:** Centralize complex communication between objects.

**ARIA trigger:** Dispatch to multiple sub-contracts, or a module that coordinates many others.

```aria
contract NightRoleAction
  dispatch on role
    when voyante -> VoyanteNightAction
    when sorciere -> SorciereNightAction
    when chasseur -> ChasseurDeathAction
    when garde -> GardeProtection
```

**TypeScript implementation:**
```typescript
// Mediator coordinates all night actions
class NightMediator {
  private handlers = new Map<RoleId, NightActionHandler>();

  register(role: RoleId, handler: NightActionHandler) {
    this.handlers.set(role, handler);
  }

  async resolveNight(game: GameState): Promise<NightResult> {
    const actions: NightAction[] = [];

    // Collect actions in order
    for (const player of this.getOrderedPlayers(game)) {
      const handler = this.handlers.get(player.role);
      if (handler) {
        const action = await handler.getAction(player, game);
        actions.push(action);
      }
    }

    // Resolve conflicts (e.g., garde protects voyante's target)
    return this.resolveConflicts(actions, game);
  }

  private resolveConflicts(actions: NightAction[], game: GameState): NightResult {
    // Central place for cross-action logic
    const gardeProtection = actions.find(a => a.type === 'protect');
    const wolfAttack = actions.find(a => a.type === 'attack');

    if (gardeProtection && wolfAttack &&
        gardeProtection.targetId === wolfAttack.targetId) {
      wolfAttack.cancelled = true; // Garde saved the target
    }

    return { actions, resolved: true };
  }
}
```

**When to use:** When multiple contracts interact and their results affect each other (night actions, vote resolution, phase transitions). The mediator is the central coordinator.

**When NOT to use:** Independent contracts that don't interact.

---

### 17. Memento

**Intent:** Capture and restore an object's internal state without violating encapsulation.

**ARIA trigger:** Contracts using `old()` in ensures, or behaviors with state history.

```aria
contract TransferFunds
  ensures
    from.balance == old(from.balance) - amount
    to.balance == old(to.balance) + amount
```

**TypeScript implementation:**
```typescript
// Memento — snapshot of game state
interface GameMemento {
  readonly timestamp: Date;
  readonly state: Readonly<GameState>;
}

class GameStateManager {
  private history: GameMemento[] = [];
  private current: GameState;

  save(): GameMemento {
    const memento: GameMemento = {
      timestamp: new Date(),
      state: structuredClone(this.current), // deep copy
    };
    this.history.push(memento);
    return memento;
  }

  restore(memento: GameMemento): void {
    this.current = structuredClone(memento.state);
  }

  // For ensures checks using old()
  getOld<K extends keyof GameState>(key: K): GameState[K] {
    const previous = this.history[this.history.length - 1];
    if (!previous) throw new Error('No previous state');
    return previous.state[key];
  }

  undo(): void {
    const previous = this.history.pop();
    if (previous) this.restore(previous);
  }
}
```

**When to use:** Specs with `old()` references (comparing before/after), save/load game, undo operations, state debugging.

**When NOT to use:** If state changes are irreversible by design (audit logs, sent emails).

---

### 18. Observer

**Intent:** Notify multiple objects when another object changes state.

**ARIA trigger:** Behavior with `invariants` and events (phase transitions, deaths, votes).

```aria
behavior GameLifecycle
  states
    night, dawn, day, vote, gameover
  invariants
    always game.players.length > 0
    never deadCount > aliveCount + 1
```

**TypeScript implementation:**
```typescript
type GameEvent =
  | { type: 'phase_changed'; from: Phase; to: Phase }
  | { type: 'player_died'; playerId: string; source: DeathSource }
  | { type: 'vote_completed'; result: VoteResult }
  | { type: 'game_over'; winner: Camp };

type EventHandler = (event: GameEvent) => void;

class GameEventBus {
  private listeners = new Map<GameEvent['type'], EventHandler[]>();

  on(type: GameEvent['type'], handler: EventHandler): () => void {
    const handlers = this.listeners.get(type) ?? [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
    return () => { // unsubscribe function
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    };
  }

  emit(event: GameEvent): void {
    const handlers = this.listeners.get(event.type) ?? [];
    for (const handler of handlers) {
      handler(event);
    }
  }
}

// Invariant checker listens to all events
class InvariantChecker {
  constructor(private bus: GameEventBus, private game: GameState) {
    bus.on('player_died', () => this.checkInvariants());
    bus.on('phase_changed', () => this.checkInvariants());
  }

  private checkInvariants() {
    if (this.game.players.length === 0) {
      throw new InvariantViolation('always game.players.length > 0');
    }
  }
}
```

**When to use:** Every behavior with `invariants` — the observer pattern enforces them reactively. Also for UI updates, logging, analytics.

**When NOT to use:** Simple request-response flows with no side effects.

---

### 19. State

**Intent:** An object changes its behavior when its internal state changes.

**ARIA trigger:** Behavior with `states` + `transitions` + `forbidden`.

```aria
behavior GameLifecycle
  states
    menu, setup, night, dawn, day, debate, vote, gameover
  initial menu
  transitions
    menu -> setup
    setup -> night
    night -> dawn
    dawn -> day
    day -> debate
    debate -> vote
    vote -> night
    vote -> gameover
  forbidden
    gameover -> menu
    night -> day
```

**TypeScript implementation:**
```typescript
interface PhaseState {
  enter(game: GameState): Promise<void>;
  exit(game: GameState): Promise<void>;
  getAvailableActions(game: GameState): ActionType[];
  canTransitionTo(target: Phase): boolean;
}

class NightState implements PhaseState {
  async enter(game: GameState) {
    game.currentPhase = 'night';
    await this.startNightActions(game);
  }

  async exit(game: GameState) {
    await this.resolveNightActions(game);
  }

  getAvailableActions() {
    return ['voyante_vision', 'sorciere_potion', 'wolf_attack', 'garde_protect'];
  }

  canTransitionTo(target: Phase): boolean {
    return target === 'dawn' || target === 'gameover';
    // 'day' is forbidden from night
  }
}

class GameStateMachine {
  private states: Record<Phase, PhaseState>;
  private current: PhaseState;

  async transition(target: Phase): Promise<void> {
    if (!this.current.canTransitionTo(target)) {
      throw new ForbiddenTransition(this.currentPhase, target);
    }
    await this.current.exit(this.game);
    this.current = this.states[target];
    await this.current.enter(this.game);
  }
}
```

**When to use:** Every `behavior` in ARIA specs. The State pattern is the natural implementation for ARIA state machines.

**When NOT to use:** Simple Enum status fields with no behavior difference between states.

---

### 20. Strategy

**Intent:** Define a family of algorithms, encapsulate each one, make them interchangeable.

**ARIA trigger:** `dispatch on field when X -> ContractX`.

```aria
contract NightRoleAction
  dispatch on role
    when voyante -> VoyanteNightAction
    when sorciere -> SorciereNightAction
    when chasseur -> ChasseurDeathAction
```

**TypeScript implementation:**
```typescript
interface NightStrategy {
  canAct(player: Player, game: GameState): boolean;
  execute(player: Player, game: GameState): Promise<ActionResult>;
}

class VoyanteStrategy implements NightStrategy {
  canAct(player: Player) { return player.isAlive && player.role === 'voyante'; }

  async execute(player: Player, game: GameState): Promise<ActionResult> {
    const target = game.selectedTarget;
    return { revealedRole: game.getPlayer(target).role };
  }
}

class SorciereStrategy implements NightStrategy {
  canAct(player: Player, game: GameState) {
    return player.isAlive && player.role === 'sorciere' &&
           (!game.sorciere.healUsed || !game.sorciere.killUsed);
  }

  async execute(player: Player, game: GameState): Promise<ActionResult> {
    // ... sorciere-specific logic
  }
}

// Strategy registry
const strategies = new Map<RoleId, NightStrategy>([
  ['voyante', new VoyanteStrategy()],
  ['sorciere', new SorciereStrategy()],
  ['chasseur', new ChasseurStrategy()],
]);

// Usage
const strategy = strategies.get(player.role);
if (strategy?.canAct(player, game)) {
  const result = await strategy.execute(player, game);
}
```

**When to use:** Every `dispatch on field` in ARIA specs. The dispatch IS a strategy pattern.

**When NOT to use:** If there's only one algorithm with no variants.

---

### 21. Template Method

**Intent:** Define the skeleton of an algorithm, let subclasses fill in specific steps.

**ARIA trigger:** Multiple contracts that share the same flow structure.

```aria
-- All night actions follow: validate → execute → resolve → record
contract VoyanteNightAction
  requires player.isAlive == true ...
  ensures result.actionResolved == true ...

contract SorciereNightAction
  requires player.isAlive == true ...
  ensures result.actionResolved == true ...
```

**TypeScript implementation:**
```typescript
abstract class NightAction {
  // Template method — fixed skeleton
  async perform(player: Player, game: GameState): Promise<ActionResult> {
    this.validatePlayer(player);          // step 1: common
    this.validatePhase(game);             // step 2: common
    const target = await this.selectTarget(player, game); // step 3: varies
    const effect = await this.applyEffect(target, game);  // step 4: varies
    this.recordAction(player, effect, game);               // step 5: common
    return { actionResolved: true, effect };
  }

  // Common steps
  private validatePlayer(player: Player) {
    if (!player.isAlive) throw new DeadPlayerError(player.id);
  }

  private validatePhase(game: GameState) {
    if (game.phase !== 'night') throw new WrongPhaseError(game.phase);
  }

  private recordAction(player: Player, effect: Effect, game: GameState) {
    game.nightLog.push({ playerId: player.id, effect, timestamp: Date.now() });
  }

  // Subclass-specific steps
  protected abstract selectTarget(player: Player, game: GameState): Promise<string>;
  protected abstract applyEffect(targetId: string, game: GameState): Promise<Effect>;
}

class VoyanteAction extends NightAction {
  protected async selectTarget(player: Player, game: GameState) {
    return game.getPlayerChoice(player.id);
  }

  protected async applyEffect(targetId: string, game: GameState) {
    return { type: 'reveal', role: game.getPlayer(targetId).role };
  }
}
```

**When to use:** When 3+ contracts share the same requires/ensures structure with different middle steps. The template method captures the common flow.

**When NOT to use:** If each contract's flow is fundamentally different.

---

### 22. Visitor

**Intent:** Add new operations to objects without modifying their classes.

**ARIA trigger:** Contracts that transform or analyze Record types in different ways.

```aria
type GameState is Record
  players: List of Player
  phase: Phase
  nightLog: List of NightAction
  voteLog: List of VoteRecord
```

**TypeScript implementation:**
```typescript
interface GameStateVisitor<T> {
  visitPlayers(players: Player[]): T;
  visitNightLog(log: NightAction[]): T;
  visitVoteLog(log: VoteRecord[]): T;
}

// Visitor 1: Generate stats
class StatsVisitor implements GameStateVisitor<GameStats> {
  visitPlayers(players: Player[]) {
    return {
      total: players.length,
      alive: players.filter(p => p.isAlive).length,
      byCamp: this.groupByCamp(players),
    };
  }

  visitNightLog(log: NightAction[]) {
    return { totalActions: log.length, kills: log.filter(a => a.type === 'kill').length };
  }

  visitVoteLog(log: VoteRecord[]) {
    return { totalVotes: log.length, eliminations: log.filter(v => v.eliminated).length };
  }
}

// Visitor 2: Serialize for save file
class SaveFileVisitor implements GameStateVisitor<JSON> {
  visitPlayers(players: Player[]) { return JSON.stringify(players); }
  visitNightLog(log: NightAction[]) { return JSON.stringify(log); }
  visitVoteLog(log: VoteRecord[]) { return JSON.stringify(log); }
}

// Visitor 3: Validate invariants
class InvariantVisitor implements GameStateVisitor<ValidationError[]> {
  visitPlayers(players: Player[]) {
    const errors: ValidationError[] = [];
    if (players.length === 0) errors.push({ rule: 'always players.length > 0' });
    return errors;
  }
  // ...
}

// Game state accepts any visitor
class GameState {
  accept<T>(visitor: GameStateVisitor<T>): Record<string, T> {
    return {
      players: visitor.visitPlayers(this.players),
      nightLog: visitor.visitNightLog(this.nightLog),
      voteLog: visitor.visitVoteLog(this.voteLog),
    };
  }
}
```

**When to use:** When you need to perform different operations (stats, serialization, validation, reporting) on the same data structures without modifying them. Especially useful for complex Record types.

**When NOT to use:** If the data structure changes frequently — every new field requires updating all visitors.

---

## Decision Guide

When reviewing ARIA-generated code, use this flowchart:

```
Does the spec have `behavior` with `states`?
  → YES → State pattern (each state = class)

Does the spec have `dispatch on field`?
  → YES → Strategy pattern (each case = strategy)

Does the spec have `steps` + `compensate`?
  → YES → Command pattern (each step = command with undo)

Does the spec have `rate_limit`, `timeout`, `retry`?
  → YES → Decorator pattern (wrap the base contract)

Does the spec have `depends_on` external service?
  → YES → Adapter pattern (normalize the external API)

Does the spec have `requires` with 3+ checks?
  → YES → Chain of Responsibility (or Proxy for simple cases)

Does the spec have `invariants` with `always`/`never`?
  → YES → Observer pattern (reactive invariant checking)

Does the spec have `old()` in ensures?
  → YES → Memento pattern (state snapshots)

Does the spec have Enum with many variants producing objects?
  → YES → Factory Method

Does the spec have Record with 5+ fields + computed?
  → YES → Builder pattern

Multiple contracts share the same flow?
  → YES → Template Method

None of the above?
  → Keep it simple. No pattern needed.
```
