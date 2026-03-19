import React from 'react';
import { Icon } from '../../../components/Icons';
import LoadingOverlay from '../../../components/LoadingOverlay';

interface MainLayoutProps {
    // 状态标志
    isLoading: boolean;
    loadingMessage?: string;
    isSidebarHidden: boolean;
    isImmersive: boolean;
    // 动作回调
    onFloatMenuClick: () => void;
    // 插槽 (Slots)
    sidebar: React.ReactNode;
    toolbar: React.ReactNode;
    content: React.ReactNode;
    modals: React.ReactNode;       // 包含所有 Modal 组件
    hiddenInputs: React.ReactNode; // 包含所有 input[type="file"]
}

export const MainLayout: React.FC<MainLayoutProps> = ({
    isLoading,
    loadingMessage,
    isSidebarHidden,
    isImmersive,
    onFloatMenuClick,
    sidebar,
    toolbar,
    content,
    modals,
    hiddenInputs,
}) => {
    return (
        <div className={`flex h-full w-full ${isSidebarHidden ? 'sidebar-hidden' : ''} ${isImmersive ? 'immersive-mode' : ''}`}>

            {/* Loading Overlay */}
            <LoadingOverlay isLoading={isLoading} message={loadingMessage} />

            {/* Floating Menu Button */}
            {(isImmersive || isSidebarHidden) && (
                <button
                    onClick={onFloatMenuClick}
                    className="no-print fixed top-5 left-5 z-[50] bg-white/90 backdrop-blur border border-gray-200 rounded-full w-[44px] h-[44px] flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                >
                    <Icon name="menu" className="w-5 h-5 text-gray-600" />
                </button>
            )}

            {/* Sidebar Slot */}
            {sidebar}

            {/* Main Content Area */}
            <div className={`flex-1 flex flex-col relative transition-[margin] duration-300 w-full overflow-hidden ${isSidebarHidden ? 'ml-0' : ''}`}>

                {/* Toolbar Slot */}
                {toolbar}

            {/* Content Area Slot */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                {content}
            </div>

            </div>

            {/* Modals Slot */}
            {modals}

            {/* Hidden Inputs Slot */}
            {hiddenInputs}

        </div>
    );
};

export default MainLayout;
