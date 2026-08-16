import { render } from '@testing-library/react';
import * as icons from '@/components/icons';

describe('icons', () => {
  const iconNames = [
    'IconPen',
    'IconChartBar',
    'IconLink',
    'IconScales',
    'IconBook',
    'IconCap',
    'IconLandmark',
    'IconFolder',
    'IconBookOpen',
    'IconFile',
    'IconPencil',
    'IconRefresh',
    'IconChat',
    'IconGavel',
    'IconBookmark',
    'IconQuestion',
    'IconSearch',
    'IconTarget',
    'IconFilePlus',
    'IconCheckCircle',
    'IconColumns',
  ];

  it.each(iconNames)('%s renders a hidden 24x24 svg', (name) => {
    const Icon = (icons as Record<string, React.ComponentType<{ size?: number }>>)[name];
    expect(Icon).toBeDefined();
    const { container } = render(<Icon />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('respects the size prop', () => {
    const { container } = render(<icons.IconSearch size={16} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '16');
    expect(svg).toHaveAttribute('height', '16');
  });
});