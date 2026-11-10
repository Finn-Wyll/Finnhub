import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'ghost' | 'accent';
type Size = 'md' | 'lg' | 'sm';

const base =
  'press inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium disabled:pointer-events-none disabled:opacity-50';

const variants: Record<Variant, string> = {
  primary: 'bg-text text-bg hover:opacity-90',
  accent: 'bg-accent text-on-accent hover:brightness-105',
  secondary: 'glass text-text hover:bg-surface-2',
  ghost: 'text-text-2 hover:text-text hover:bg-surface-2',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-[0.9375rem]',
  lg: 'h-12 px-6 text-base',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'primary', size = 'md', icon, className = '', children, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
});

interface LinkBtnProps extends LinkProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function LinkButton({ variant = 'primary', size = 'md', icon, className = '', children, ...rest }: LinkBtnProps) {
  return (
    <Link className={buttonClass(variant, size, className as string)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

interface IconBtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: 'glass' | 'plain';
}

export const IconButton = forwardRef<HTMLButtonElement, IconBtnProps>(function IconButton(
  { label, variant = 'glass', className = '', children, type = 'button', ...rest },
  ref,
) {
  const look = variant === 'glass' ? 'glass text-text hover:bg-surface-2' : 'text-text-2 hover:text-text hover:bg-surface-2';
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={`press inline-grid size-10 shrink-0 place-items-center rounded-full ${look} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
