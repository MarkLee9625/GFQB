import React from 'react';
import { CONSTANTS } from '../src/constants';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  fallbackRender?: (error: Error, reset: () => void) => React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallbackRender) {
        return this.props.fallbackRender(
          this.state.error || new Error('Unknown error'),
          () => this.setState({ hasError: false, error: undefined })
        );
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="fixed inset-0 bg-white/95 z-[9999] flex flex-col items-center justify-center backdrop-blur-[4px]">
          <div className="text-center max-w-md px-6">
            <div className="text-red-600 text-lg font-bold mb-2">组件加载失败</div>
            <div className="text-gray-500 text-sm mb-4">{this.state.error?.message}</div>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="px-6 py-2 bg-brand-blue text-white rounded-lg text-sm font-bold hover:bg-brand-dark transition-colors"
            >
              重试
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface DBErrorBoundaryProps {
  children: React.ReactNode;
}

interface DBErrorState {
  hasError: boolean;
  error?: Error;
}

export class DBErrorBoundary extends React.Component<DBErrorBoundaryProps, DBErrorState> {
  constructor(props: DBErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): DBErrorState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('DBErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 shadow-2xl max-w-md">
            <h2 className="text-xl font-bold text-red-600 mb-4">数据库加载失败</h2>
            <p className="text-sm text-gray-600 mb-4">
              应用程序无法加载本地数据库，可能是因为数据文件损坏或存储空间不足。
            </p>
            <p className="text-xs text-gray-400 mb-4">
              错误信息: {this.state.error?.message}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-blue-600"
              >
                重新加载
              </button>
              <button
                onClick={() => {
                  if (window.confirm('确定要清除所有本地数据吗？此操作不可恢复。')) {
                    localStorage.clear();
                    // 库名必须与 services/db.ts 的 CONSTANTS.DB_NAME 一致，否则清库静默失败
                    indexedDB.deleteDatabase(CONSTANTS.DB_NAME);
                    window.location.reload();
                  }
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                清除数据
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}