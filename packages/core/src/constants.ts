export enum ReactiveFlags {
  SKIP = "__lu_skip",
  IS_REACTIVE = "__lu_isReactive",
  IS_READONLY = "__lu_isReadonly",
  IS_SHALLOW = "__lu_isShallow",
  RAW = "__lu_raw"
}

export enum SystemFlags {
  None = 0,
  Watching = 1 << 0,
  RecursedCheck = 1 << 1,
  Recursed = 1 << 2,
  Dirty = 1 << 3,
  Pending = 1 << 4
}

export enum TargetType {
  INVALID = 0,
  COMMON = 1
}

export enum TrackOpTypes {
  GET = "get",
  HAS = "has",
  ITERATE = "iterate"
}

export enum TriggerOpTypes {
  SET = "set",
  ADD = "add",
  DELETE = "delete",
  CLEAR = "clear"
}
