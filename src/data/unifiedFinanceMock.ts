// [G005 PERF1] 与 financeMock.ts 数据完全一致(字节级相同), 保留 financeMock.ts 为唯一数据源
// 此处仅 re-export, 消除 4.6MB 重复数据 (mockBackend/store.ts 动态 import 该模块, 兼容不变)
export * from './financeMock';
