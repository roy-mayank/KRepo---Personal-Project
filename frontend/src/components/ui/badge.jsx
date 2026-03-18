import { cn } from '@/lib/utils'

function Badge({ className, variant = 'default', ...props }) {
  const variants = {
    default: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    outline: 'border border-border text-foreground',
    destructive: 'bg-destructive text-destructive-foreground',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variants[variant] ?? variants.default,
        className,
      )}
      {...props}
    />
  )
}

export { Badge }
