import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { PASSWORD_RULES } from '../utils/password';
import { colors, typography } from '../theme';

/** Live checklist of password requirements; hidden until the user starts typing. */
export default function PasswordRequirements({ password }: { password: string }) {
    if (password.length === 0) return null;

    return (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {PASSWORD_RULES.map((rule) => {
                const met = rule.test(password);
                return (
                    <Box
                        component="li"
                        key={rule.key}
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                        <Box
                            component="span"
                            aria-hidden="true"
                            sx={{
                                fontFamily: typography.ui,
                                fontSize: '12px',
                                lineHeight: 1,
                                width: 14,
                                color: met ? colors.text : colors.textSecondary,
                            }}
                        >
                            {met ? '✓' : '○'}
                        </Box>
                        <Typography
                            sx={{
                                fontFamily: typography.ui,
                                fontSize: '12px',
                                color: met ? colors.text : colors.textSecondary,
                                textDecoration: met ? 'line-through' : 'none',
                            }}
                        >
                            {rule.label}
                        </Typography>
                    </Box>
                );
            })}
        </Box>
    );
}
