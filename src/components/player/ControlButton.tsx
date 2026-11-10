import { forwardRef, type ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: 'md' | 'lg' | 'xl';
  active?: boolean;
}

const sizes = { md: 'size-11', lg: 'size-14', xl: 'size-[72px]' };

/** Player control: always white on dark media, with a glass hover state. */
export const ControlButton = forwardRef<HTMLButtonElement, Props>(function ControlButton(
  { label, size = 'md', active, className = '', children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={`press relative inline-grid shrink-0 place-items-center rounded-full text-white outline-offset-2 hover:bg-white/12 focus-visible:bg-white/12 ${sizes[size]} ${
        active ? 'bg-white/14' : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
