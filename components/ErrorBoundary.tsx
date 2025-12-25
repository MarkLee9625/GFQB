import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Icon } from './Icons';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// 使用更明确的类型声明来解决TypeScript问题
export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };
  
  constructor(props: Props) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    // 使用类型断言解决React 19.2.3的类型问题
    (this as any).setState({
      error,
      errorInfo
    });
    
    // 可以在这里添加错误上报逻辑
    // reportErrorToService(error, errorInfo);
  }

  handleReset = (): void => {
    // 使用类型断言解决React 19.2.3的类型问题
    (this as any).setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
    
    // 尝试重新加载应用数据
    if (typeof window !== 'undefined') {
      localStorage.removeItem('SWS_CATS_REACT');
      window.location.reload();
    }
  };

  handleGoHome = (): void => {
    // 使用类型断言解决React 19.2.3的类型问题
    (this as any).setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
    
    // 清除错误状态，返回初始状态
    if (typeof window !== 'undefined') {
      window.location.hash = '';
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // 使用自定义的fallback或者默认的错误UI
      // 使用类型断言解决React 19.2.3的类型问题
      if ((this as any).props.fallback) {
        return (this as any).props.fallback;
      }

      return (
        <div className="fixed inset-0 bg-white z-[9999] flex flex-col items-center justify-center p-8">
          <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg border border-gray-200 p-8">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <Icon name="alert" className="w-8 h-8 text-red-500" />
              </div>
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 text-center mb-4">
              应用遇到错误
            </h1>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700 font-medium mb-2">
                {this.state.error?.message || '未知错误'}
              </p>
              {this.state.errorInfo && (
                <details className="mt-2">
                  <summary className="text-sm text-red-600 cursor-pointer hover:text-red-800">
                    查看错误详情
                  </summary>
                  <pre className="mt-2 text-xs text-red-800 bg-red-100 p-3 rounded overflow-auto max-h-40">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            <div className="text-sm text-gray-600 mb-8 text-center">
              <p>抱歉，应用遇到了意外错误。这可能是由于数据损坏或浏览器兼容性问题。</p>
              <p className="mt-2">您可以尝试以下解决方案：</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={this.handleReset}
                className="px-6 py-3 bg-brand-blue text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="refresh" className="w-4 h-4" />
                重置应用并重试
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="home" className="w-4 h-4" />
                返回首页
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                如果问题持续存在，请尝试：
              </p>
              <ul className="text-xs text-gray-500 mt-2 space-y-1 text-center">
                <li>• 清除浏览器缓存和Cookie</li>
                <li>• 检查浏览器是否支持IndexedDB</li>
                <li>• 确保有足够的存储空间</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

// 专门用于数据库错误的错误边界
interface DBErrorBoundaryState {
  hasDBError: boolean;
}

export class DBErrorBoundary extends Component<Props, DBErrorBoundaryState> {
  state: DBErrorBoundaryState = { hasDBError: false };
  
  constructor(props: Props) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): DBErrorBoundaryState {
    if (error.message.includes('IndexedDB') || error.message.includes('数据库')) {
      return { hasDBError: true };
    }
    return { hasDBError: false };
  }

  componentDidCatch(error: Error): void {
    console.error('数据库错误:', error);
  }

  handleFixDB = (): void => {
    // 尝试修复数据库
    if (typeof window !== 'undefined' && window.indexedDB) {
      const dbName = 'SWS_DATABASE_REACT';
      const request = indexedDB.deleteDatabase(dbName);
      
      request.onsuccess = () => {
        console.log('数据库已重置');
        // 使用类型断言解决React 19.2.3的类型问题
        (this as any).setState({ hasDBError: false });
        window.location.reload();
      };
      
      request.onerror = () => {
        console.error('无法重置数据库');
      };
    }
  };

  render(): ReactNode {
    if (this.state.hasDBError) {
      return (
        <div className="fixed inset-0 bg-white z-[9999] flex flex-col items-center justify-center p-8">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-gray-200 p-8">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
                <Icon name="database" className="w-8 h-8 text-yellow-500" />
              </div>
            </div>
            
            <h1 className="text-xl font-bold text-gray-900 text-center mb-4">
              数据库错误
            </h1>
            
            <div className="text-sm text-gray-600 mb-6 text-center">
              <p>无法访问本地数据库。这可能是由于浏览器隐私设置或数据库损坏。</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={this.handleFixDB}
                className="w-full px-6 py-3 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600 transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="refresh" className="w-4 h-4" />
                重置数据库
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                刷新页面
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                注意：重置数据库将清除所有本地保存的数据。
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
