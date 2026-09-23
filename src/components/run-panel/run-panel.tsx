import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import Journal from '@/components/journal';
import Button from '@/components/shared_ui/button';
import Drawer from '@/components/shared_ui/drawer';
import Modal from '@/components/shared_ui/modal';
import Money from '@/components/shared_ui/money';
import Tabs from '@/components/shared_ui/tabs';
import Text from '@/components/shared_ui/text';
import Summary from '@/components/summary';
import TradeAnimation from '@/components/trade-animation';
import Transactions from '@/components/transactions';
import { popover_zindex } from '@/constants/z-indexes';
import { useStore } from '@/hooks/useStore';
import { Localize, localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import ThemedScrollbars from '../shared_ui/themed-scrollbars';

type TStatisticsTile = {
    content: React.ElementType | string;
    contentClassName: string;
    title: string;
};

type TStatisticsSummary = {
    currency: string;
    is_mobile: boolean;
    lost_contracts: number;
    number_of_runs: number;
    total_stake: number;
    total_payout: number;
    toggleStatisticsInfoModal: () => void;
    total_profit: number;
    won_contracts: number;
};
type TDrawerHeader = {
    is_clear_stat_disabled: boolean;
    is_mobile: boolean;
    is_drawer_open: boolean;
    onClearStatClick: () => void;
    onClosePanel: () => void;
};

type TDrawerContent = {
    active_index: number;
    is_drawer_open: boolean;
    active_tour: string;
    setActiveTabIndex: () => void;
};

type TDrawerFooter = {
    is_clear_stat_disabled: boolean;
    onClearStatClick: () => void;
};

type TStatisticsInfoModal = {
    is_mobile: boolean;
    is_statistics_info_modal_open: boolean;
    toggleStatisticsInfoModal: () => void;
};

const StatisticsTile = ({ content, contentClassName, title }: TStatisticsTile) => (
    <div className='run-panel__tile'>
        <div className='run-panel__tile-title'>{title}</div>
        <div className={classNames('run-panel__tile-content', contentClassName)}>{content}</div>
    </div>
);

export const StatisticsSummary = ({
    currency,
    is_mobile,
    lost_contracts,
    number_of_runs,
    total_stake,
    total_payout,
    toggleStatisticsInfoModal,
    total_profit,
    won_contracts,
}: TStatisticsSummary) => (
    <div
        className={classNames('run-panel__stat', {
            'run-panel__stat--mobile': is_mobile,
        })}
    >
        <div className='run-panel__stat--info' onClick={toggleStatisticsInfoModal}>
            <div className='run-panel__stat--info-item'>
                <Localize i18n_default_text="What's this?" />
            </div>
        </div>
        <div className='run-panel__stat--tiles'>
            <StatisticsTile
                title={localize('Total stake')}
                alignment='top'
                content={<Money amount={total_stake} currency={currency} show_currency />}
            />
            <StatisticsTile
                title={localize('Total payout')}
                alignment='top'
                content={<Money amount={total_payout} currency={currency} show_currency />}
            />
            <StatisticsTile title={localize('No. of runs')} alignment='top' content={number_of_runs} />
            <StatisticsTile title={localize('Contracts lost')} alignment='bottom' content={lost_contracts} />
            <StatisticsTile title={localize('Contracts won')} alignment='bottom' content={won_contracts} />
            <StatisticsTile
                title={localize('Total profit/loss')}
                content={<Money amount={total_profit} currency={currency} has_sign show_currency />}
                alignment='bottom'
                contentClassName={classNames('run-panel__stat-amount', {
                    'run-panel__stat-amount--positive': total_profit > 0,
                    'run-panel__stat-amount--negative': total_profit < 0,
                })}
            />
        </div>
    </div>
);

const DrawerHeader = ({ is_clear_stat_disabled, is_mobile, is_drawer_open, onClearStatClick, onClosePanel }: TDrawerHeader) =>
    is_mobile &&
    is_drawer_open && (
        <div className='run-panel__mobile-header'>
            <div className='run-panel__mobile-header-actions'>
            <Button
                id='db-run-panel__close-button'
                className='run-panel__close-button'
                text='⌄'
                onClick={onClosePanel}
                secondary
            />
            <Button
            id='db-run-panel__clear-button'
            className='run-panel__clear-button'
            disabled={is_clear_stat_disabled}
            text={localize('Reset')}
            onClick={onClearStatClick}
            secondary
            />
            </div>
        </div>
    );

const DrawerContent = ({ active_index, is_drawer_open, active_tour, setActiveTabIndex, ...props }: TDrawerContent) => {
    const { isDesktop } = useDevice();
    // Use the useBlockScroll hook to prevent body scrolling when drawer is open on mobile

    React.useEffect(() => {
        if (!isDesktop && is_drawer_open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [is_drawer_open, isDesktop]);

    return (
        <>
            <Tabs active_index={active_index} onTabItemClick={setActiveTabIndex} top>
                <div id='db-run-panel-tab__summary' label={<Localize i18n_default_text='Summary' />}>
                    <Summary is_drawer_open={is_drawer_open} />
                </div>
                <div id='db-run-panel-tab__transactions' label={<Localize i18n_default_text='Transactions' />}>
                    <Transactions is_drawer_open={is_drawer_open} />
                </div>
                <div id='db-run-panel-tab__journal' label={<Localize i18n_default_text='Journal' />}>
                    <Journal />
                </div>
            </Tabs>
            {((is_drawer_open && active_index !== 1 && active_index !== 2) || active_tour) && (
                <StatisticsSummary {...props} />
            )}
        </>
    );
};

const DrawerFooter = ({ is_clear_stat_disabled, onClearStatClick }: TDrawerFooter) => (
    <div className='run-panel__footer'>
        <Button
            id='db-run-panel__clear-button'
            className='run-panel__footer-button'
            disabled={is_clear_stat_disabled}
            onClick={onClearStatClick}
            has_effect
            secondary
        >
            <span>
                <Localize i18n_default_text='Reset' />
            </span>
        </Button>
    </div>
);

const MobileDrawerFooter = () => {
    const { run_panel } = useStore();
    const { setActiveTabIndex, toggleDrawer } = run_panel;

    const openTransactions = () => {
        // Open the full transaction/run surface and preserve the Summary tab,
        // matching the mobile Bot Builder layout.
        toggleDrawer(true);
    };

    return (
        <div className='controls__section'>
            <div className='controls__buttons'>
                <TradeAnimation className='controls__animation' should_show_overlay />
                <Button
                    id='db-run-panel__open-transactions'
                    className='controls__transactions-button'
                    secondary
                    onClick={openTransactions}
                >
                    <Localize i18n_default_text='Open transaction' />
                </Button>
            </div>
        </div>
    );
};

const StatisticsInfoModal = ({
    is_mobile,
    is_statistics_info_modal_open,
    toggleStatisticsInfoModal,
}: TStatisticsInfoModal) => {
    return (
        <Modal
            className={classNames('statistics__modal', { 'statistics__modal--mobile': is_mobile })}
            title={localize("What's this?")}
            is_open={is_statistics_info_modal_open}
            toggleModal={toggleStatisticsInfoModal}
            width={'440px'}
        >
            <Modal.Body>
                <div className={classNames('statistics__modal-body', { 'statistics__modal-body--mobile': is_mobile })}>
                    <ThemedScrollbars className='statistics__modal-scrollbar'>
                        <Text as='p' weight='bold' className='statistics__modal-body--content no-margin'>
                            <Localize i18n_default_text='Total stake' />
                        </Text>
                        <Text as='p'>
                            <Localize i18n_default_text='Total stake since you last cleared your stats.' />
                        </Text>
                        <Text as='p' weight='bold' className='statistics__modal-body--content'>
                            <Localize i18n_default_text='Total payout' />
                        </Text>
                        <Text as='p'>{localize('Total payout since you last cleared your stats.')}</Text>
                        <Text as='p' weight='bold' className='statistics__modal-body--content'>
                            <Localize i18n_default_text='No. of runs' />
                        </Text>
                        <Text as='p'>
                            <Localize i18n_default_text='The number of times your bot has run since you last cleared your stats. Each run includes the execution of all the root blocks.' />
                        </Text>
                        <Text as='p' weight='bold' className='statistics__modal-body--content'>
                            <Localize i18n_default_text='Contracts lost' />
                        </Text>
                        <Text as='p'>
                            <Localize i18n_default_text='The number of contracts you have lost since you last cleared your stats.' />
                        </Text>
                        <Text as='p' weight='bold' className='statistics__modal-body--content'>
                            <Localize i18n_default_text='Contracts won' />
                        </Text>
                        <Text as='p'>
                            <Localize i18n_default_text='The number of contracts you have won since you last cleared your stats.' />
                        </Text>
                        <Text as='p' weight='bold' className='statistics__modal-body--content'>
                            <Localize i18n_default_text='Total profit/loss' />
                        </Text>
                        <Text as='p'>
                            <Localize i18n_default_text='Your total profit/loss since you last cleared your stats. It is the difference between your total payout and your total stake.' />
                        </Text>
                    </ThemedScrollbars>
                </div>
            </Modal.Body>
        </Modal>
    );
};

const RunPanel = observer(() => {
    const { run_panel, dashboard, transactions } = useStore();
    const { client } = useStore();
    const { isDesktop } = useDevice();
    const { currency } = client;
    const {
        active_index,
        is_drawer_open,
        is_statistics_info_modal_open,
        is_clear_stat_disabled,
        onClearStatClick,
        onMount,
        onRunButtonClick, // eslint-disable-line @typescript-eslint/no-unused-vars
        onUnmount,
        setActiveTabIndex,
        toggleDrawer,
        toggleStatisticsInfoModal,
    } = run_panel;
    const { statistics } = transactions;
    const { active_tour } = dashboard;
    const { total_payout, total_profit, total_stake, won_contracts, lost_contracts, number_of_runs } = statistics;

    React.useEffect(() => {
        onMount();
        return () => onUnmount();
    }, [onMount, onUnmount]);

    React.useEffect(() => {
        if (!isDesktop) {
            toggleDrawer(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const content = (
        <DrawerContent
            active_index={active_index}
            currency={currency}
            is_drawer_open={is_drawer_open}
            is_mobile={!isDesktop}
            lost_contracts={lost_contracts}
            number_of_runs={number_of_runs}
            setActiveTabIndex={setActiveTabIndex}
            toggleStatisticsInfoModal={toggleStatisticsInfoModal}
            total_payout={total_payout}
            total_profit={total_profit}
            total_stake={total_stake}
            won_contracts={won_contracts}
            active_tour={active_tour}
        />
    );

    const footer = <DrawerFooter is_clear_stat_disabled={is_clear_stat_disabled} onClearStatClick={onClearStatClick} />;

    const header = (
        <DrawerHeader
            is_clear_stat_disabled={is_clear_stat_disabled}
            is_mobile={!isDesktop}
            is_drawer_open={is_drawer_open}
            onClearStatClick={onClearStatClick}
            onClosePanel={() => toggleDrawer(false)}
        />
    );

    // PROD B uses the native Deriv Run Panel as a global execution surface.
    // Keep it mounted on every authenticated premium section so the same
    // drawer state, summary, transactions, journal, and run controls persist
    // while the user moves between tools.
    if (active_tour === 'bot_builder') return null;

    return (
        <>
            <div className={!isDesktop && is_drawer_open ? 'run-panel__container--mobile' : 'run-panel'}>
                <Drawer
                    anchor='right'
                    className={classNames('run-panel', {
                        'run-panel__container': isDesktop,
                        'run-panel__container--tour-active': isDesktop && active_tour,
                    })}
                    contentClassName='run-panel__content'
                    header={header}
                    footer={isDesktop && footer}
                    is_open={is_drawer_open}
                    toggleDrawer={toggleDrawer}
                    width={366}
                    zIndex={popover_zindex.RUN_PANEL}
                >
                    {content}
                </Drawer>
                {!isDesktop && <MobileDrawerFooter />}
            </div>


            <style>{`
                @media (max-width: 767px) {
                    /* One shared mobile transaction surface for Dashboard, Bot Builder,
                       Free Bots, Manual Trading and every other premium page. */
                    .run-panel__container--mobile {
                        position: fixed !important;
                        inset: 0 !important;
                        width: 100vw !important;
                        height: 100dvh !important;
                        min-height: 100dvh !important;
                        max-height: 100dvh !important;
                        z-index: 190 !important;
                        background: #071525 !important;
                        overflow: hidden !important;
                    }

                    .run-panel__container--mobile .run-panel,
                    .run-panel__container--mobile .run-panel__content {
                        width: 100vw !important;
                        height: 100dvh !important;
                        min-height: 0 !important;
                        max-height: 100dvh !important;
                        background: #071525 !important;
                        color: #f5f7fa !important;
                        overflow: hidden !important;
                    }

                    /* The website's normal header already contains the live balance.
                       Do not create a second balance card inside Transactions. */
                    .run-panel__container--mobile .run-panel__mobile-balance,
                    .run-panel__mobile-balance {
                        display: none !important;
                    }

                    /* Black toolbar: collapse + Reset. */
                    .run-panel__container--mobile .run-panel__mobile-header {
                        display: block !important;
                        width: 100% !important;
                        height: 112px !important;
                        min-height: 112px !important;
                        max-height: 112px !important;
                        padding: 0 !important;
                        background: #0b0b0b !important;
                        color: #f7f7f7 !important;
                        box-sizing: border-box !important;
                    }

                    .run-panel__container--mobile .run-panel__mobile-header-actions {
                        display: flex !important;
                        align-items: center !important;
                        justify-content: space-between !important;
                        gap: 18px !important;
                        width: 100% !important;
                        height: 112px !important;
                        min-height: 112px !important;
                        padding: 0 24px !important;
                        background: #0b0b0b !important;
                        box-sizing: border-box !important;
                    }

                    .run-panel__container--mobile .run-panel__close-button,
                    .run-panel__container--mobile .run-panel__clear-button {
                        position: static !important;
                        background: #0b0b0b !important;
                        color: #f7f7f7 !important;
                        border: 1px solid #5a5a5a !important;
                        border-radius: 15px !important;
                        box-shadow: none !important;
                        font-weight: 900 !important;
                        flex: 0 0 auto !important;
                    }

                    .run-panel__container--mobile .run-panel__close-button {
                        width: 108px !important;
                        min-width: 108px !important;
                        height: 86px !important;
                        min-height: 86px !important;
                    }

                    .run-panel__container--mobile .run-panel__clear-button {
                        width: 170px !important;
                        min-width: 170px !important;
                        height: 86px !important;
                        min-height: 86px !important;
                    }

                    /* Tabs directly below toolbar. */
                    .run-panel__container--mobile .dc-tabs,
                    .run-panel__container--mobile .tabs {
                        display: flex !important;
                        flex-direction: column !important;
                        width: 100% !important;
                        height: calc(100dvh - 112px) !important;
                        min-height: 0 !important;
                        background: #071525 !important;
                    }

                    .run-panel__container--mobile .dc-tabs__list,
                    .run-panel__container--mobile .tabs__list {
                        display: flex !important;
                        flex: 0 0 110px !important;
                        width: 100% !important;
                        height: 110px !important;
                        min-height: 110px !important;
                        background: #151515 !important;
                        border-bottom: 1px solid #222 !important;
                    }

                    .run-panel__container--mobile .dc-tabs__item,
                    .run-panel__container--mobile .tabs__item {
                        flex: 1 1 33.333% !important;
                        min-width: 0 !important;
                        height: 110px !important;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        padding: 0 8px !important;
                        color: #aebbd0 !important;
                        font-size: 20px !important;
                        font-weight: 850 !important;
                        white-space: nowrap !important;
                        overflow: hidden !important;
                        text-overflow: ellipsis !important;
                        box-sizing: border-box !important;
                    }

                    .run-panel__container--mobile .dc-tabs__item--active,
                    .run-panel__container--mobile .tabs__item--active {
                        color: #f1f5f9 !important;
                        border-bottom: 4px solid #3b82f6 !important;
                    }

                    .run-panel__container--mobile .dc-tabs__content,
                    .run-panel__container--mobile .tabs__content {
                        flex: 1 1 auto !important;
                        width: 100% !important;
                        min-height: 0 !important;
                        height: auto !important;
                        overflow: hidden !important;
                        background: #071525 !important;
                    }

                    .run-panel__container--mobile .transactions,
                    .run-panel__container--mobile [class*="transactions"],
                    .run-panel__container--mobile .run-panel__content {
                        background: #071525 !important;
                        color: #f5f7fa !important;
                    }

                    /* Statistics strip. */
                    .run-panel__container--mobile .run-panel__stat--mobile {
                        width: 100% !important;
                        height: 170px !important;
                        min-height: 170px !important;
                        max-height: 170px !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #151515 !important;
                        border-top: 1px solid #273244 !important;
                        overflow: hidden !important;
                        box-sizing: border-box !important;
                    }

                    .run-panel__container--mobile .run-panel__stat--info {
                        height: 38px !important;
                        min-height: 38px !important;
                        padding: 12px 24px 0 !important;
                        color: #7e8a9c !important;
                        background: #151515 !important;
                        box-sizing: border-box !important;
                    }

                    .run-panel__container--mobile .run-panel__stat--tiles {
                        display: flex !important;
                        flex-wrap: nowrap !important;
                        width: 100% !important;
                        height: 132px !important;
                        min-height: 132px !important;
                        padding: 6px 20px 12px !important;
                        gap: 12px !important;
                        overflow-x: auto !important;
                        overflow-y: hidden !important;
                        background: #151515 !important;
                        box-sizing: border-box !important;
                    }

                    .run-panel__container--mobile .run-panel__tile {
                        flex: 0 0 118px !important;
                        width: 118px !important;
                        min-width: 118px !important;
                        height: 112px !important;
                        margin: 0 !important;
                        border: 1px solid #2c3a4d !important;
                        border-radius: 13px !important;
                        background: #0b0f14 !important;
                        color: #f5f7fa !important;
                        box-sizing: border-box !important;
                    }

                    .run-panel__container--mobile .run-panel__tile-title {
                        margin-top: 20px !important;
                        color: #7e8a9c !important;
                        font-size: 9px !important;
                        font-weight: 800 !important;
                        text-transform: uppercase !important;
                    }

                    .run-panel__container--mobile .run-panel__tile-content {
                        margin-top: 9px !important;
                        color: #f5f7fa !important;
                        font-size: 16px !important;
                        font-weight: 900 !important;
                    }

                    /* Bottom Run / status / Open transaction bar. */
                    .controls__section {
                        position: fixed !important;
                        left: 0 !important;
                        right: 0 !important;
                        bottom: 0 !important;
                        width: 100vw !important;
                        height: 72px !important;
                        min-height: 72px !important;
                        z-index: 250 !important;
                        background: #071525 !important;
                        border-top: 1px solid #273244 !important;
                        box-sizing: border-box !important;
                    }

                    .controls__buttons {
                        display: flex !important;
                        width: 100% !important;
                        height: 72px !important;
                        min-height: 72px !important;
                        padding: 8px 22px !important;
                        gap: 0 !important;
                        background: #071525 !important;
                        box-sizing: border-box !important;
                    }

                    .controls__transactions-button {
                        background: #f7f7f7 !important;
                        color: #171717 !important;
                    }
                }
            `}</style>    `}</style>

            <StatisticsInfoModal
                is_mobile={!isDesktop}
                is_statistics_info_modal_open={is_statistics_info_modal_open}
                toggleStatisticsInfoModal={toggleStatisticsInfoModal}
            />
        </>
    );
});

export default RunPanel;
