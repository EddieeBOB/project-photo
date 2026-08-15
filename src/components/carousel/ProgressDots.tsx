import Box from '@mui/material/Box';
import { styled } from '@mui/material/styles';

import { colors } from '../../theme';

const Dash = styled(Box, {
    shouldForwardProp: (prop) => prop !== 'active',
})<{ active: boolean }>(({ active }) => ({
    height: '1px',
    width: '40px',
    backgroundColor: active ? colors.text : colors.borderLight,
    transition: 'background-color 0.3s ease',
}));

interface ProgressDotsProps {
    count: number;
    activeIndex: number;
}

/** Row of dashes under a carousel marking how far through the deck you are. */
export default function ProgressDots({ count, activeIndex }: ProgressDotsProps) {
    return (
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 4 }}>
            {Array.from({ length: count }, (_, index) => (
                <Dash key={index} active={index === activeIndex} />
            ))}
        </Box>
    );
}
