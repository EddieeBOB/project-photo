import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Translation } from 'react-i18next';
import { colors, typography, PrimaryButton } from '../theme';

interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}

export default class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    ErrorBoundaryState
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("Application error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <Translation>
                    {(t) => (
                        <Box sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '50vh',
                            p: 4
                        }}>
                            <Typography sx={{
                                fontFamily: typography.headline,
                                fontSize: '32px',
                                color: colors.text,
                                mb: 2
                            }}>
                                {t('errorBoundary.somethingWentWrong')}
                            </Typography>
                            <Typography sx={{
                                fontFamily: typography.ui,
                                color: colors.textSecondary,
                                mb: 4,
                                textAlign: 'center',
                                maxWidth: '400px'
                            }}>
                                {t('errorBoundary.unexpectedError')}
                            </Typography>
                            <PrimaryButton onClick={() => window.location.reload()}>
                                {t('errorBoundary.reloadPage')}
                            </PrimaryButton>
                        </Box>
                    )}
                </Translation>
            );
        }
        return this.props.children;
    }
}
