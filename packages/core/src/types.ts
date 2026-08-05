import type { ReactiveFlags, SystemFlags, TrackOpTypes, TriggerOpTypes } from "./constants";
import type { ReactiveEffect } from "./effect";

interface DebuggerOptions {
  onTrack?: (event: DebuggerEvent) => void;
  onTrigger?: (event: DebuggerEvent) => void;
}

export type DebuggerEventExtraInfo = {
  target: object;
  type: TrackOpTypes | TriggerOpTypes;
  key: any;
  newValue?: any;
  oldValue?: any;
  oldTarget?: Map<any, any> | Set<any> | undefined;
};

export type DebuggerEvent = {
  effect: ReactiveNode;
} & DebuggerEventExtraInfo;

type EffectScheduler = (...args: any[]) => any;

export interface Link {
  version: number;
  dep: ReactiveNode | ReactiveEffect;
  sub: ReactiveNode | ReactiveEffect;
  prevSub: Link | undefined;
  nextSub: Link | undefined;
  prevDep: Link | undefined;
  nextDep: Link | undefined;
}

export interface ReactiveEffectOptions extends DebuggerOptions {
  scheduler?: EffectScheduler | undefined;
  onStop?: (() => void) | undefined;
}

export interface ReactiveEffectRunner<T = any> {
  (): T;
  effect: ReactiveEffect;
}

export interface ReactiveNode {
  deps?: Link | undefined;
  depsTail?: Link | undefined;
  subs?: Link | undefined;
  subsTail?: Link | undefined;
  flags: SystemFlags;
}

export interface Target {
  [ReactiveFlags.SKIP]?: boolean;
  [ReactiveFlags.IS_REACTIVE]?: boolean;
  [ReactiveFlags.IS_READONLY]?: boolean;
  [ReactiveFlags.IS_SHALLOW]?: boolean;
  [ReactiveFlags.RAW]?: any;
}

type Primitive = string | number | boolean | bigint | symbol | undefined | null;
type Builtin = Primitive | Function | Date | Error | RegExp;

declare const RawSymbol: unique symbol;

declare const ReactiveMarkerSymbol: unique symbol;
interface ReactiveMarker {
  [ReactiveMarkerSymbol]?: void;
}

export type Reactive<T> = UnwrapNestedReactive<T> & (T extends readonly any[] ? ReactiveMarker : {});

export type DeepReadonly<T> = T extends Builtin
  ? T
  : T extends Promise<infer U>
    ? Promise<DeepReadonly<U>>
    : T extends {}
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : Readonly<T>;

type UnwrapNestedReactive<T> = T extends Builtin | { [RawSymbol]?: true }
  ? T
  : T extends ReadonlyArray<any>
    ? { [K in keyof T]: UnwrapNestedReactive<T[K]> }
    : T extends object
      ? {
          [P in keyof T]: P extends symbol ? T[P] : UnwrapNestedReactive<T[P]>;
        }
      : T;
