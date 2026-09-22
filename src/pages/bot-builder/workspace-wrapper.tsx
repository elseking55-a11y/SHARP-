import React from 'react';
import { observer } from 'mobx-react-lite';
import Flyout from '@/components/flyout';
import { useStore } from '@/hooks/useStore';
import StopBotModal from '../dashboard/stop-bot-modal';
import Toolbar from './toolbar';
import Toolbox from './toolbox';
import './workspace.scss';

const WorkspaceWrapper = observer(() => {
    const { blockly_store } = useStore();
    const { onMount, onUnmount } = blockly_store;
    const [workspaceReady, setWorkspaceReady] = React.useState(
        () => Boolean(window.Blockly?.derivWorkspace)
    );

    React.useEffect(() => {
        onMount();

        // Keep Blockly/account startup non-blocking for the editor UI.
        // The workspace becomes visible as soon as native Blockly is injected.
        let cancelled = false;
        let timer: number | undefined;

        const checkWorkspace = () => {
            if (cancelled) return;
            if (window.Blockly?.derivWorkspace) {
                setWorkspaceReady(true);
                return;
            }
            timer = window.setTimeout(checkWorkspace, 50);
        };

        checkWorkspace();

        return () => {
            cancelled = true;
            if (timer) window.clearTimeout(timer);
            onUnmount();
        };
    }, [onMount, onUnmount]);

    if (!workspaceReady || !window.Blockly?.derivWorkspace) return null;

    return (
        <React.Fragment>
            <Toolbox />
            <Toolbar />
            <Flyout />
            <StopBotModal />
        </React.Fragment>
    );
});

export default WorkspaceWrapper;
