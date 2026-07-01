import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { colors, typography } from '../theme';

interface AuthLayoutProps {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
}

/** Centered single-column shell used by the standalone auth pages. */
export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
    return (
        <Box sx={{ display: 'flex', flexGrow: 1, backgroundColor: colors.surface }}>
            <Container maxWidth="sm" sx={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                px: { xs: 3, md: 6 },
                pt: { xs: 16, md: 8 },
                pb: 8,
            }}>
                <Box sx={{ width: '100%', maxWidth: '420px' }}>
                    <Typography
                        variant="h1"
                        sx={{
                            fontFamily: typography.headline,
                            fontSize: { xs: '32px', md: '44px' },
                            color: colors.text,
                            mb: subtitle ? 2 : 4,
                        }}
                    >
                        {title}
                    </Typography>
                    {subtitle && (
                        <Typography sx={{ fontFamily: typography.ui, color: colors.textSecondary, mb: 5, lineHeight: 1.6 }}>
                            {subtitle}
                        </Typography>
                    )}
                    {children}
                </Box>
            </Container>
        </Box>
    );
}