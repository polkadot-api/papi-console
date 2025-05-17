import * as Toggle from "@radix-ui/react-toggle"

const SliderToggle: React.FC<{
  isToggled: boolean
  toggle: () => void
  id?: string
}> = ({ isToggled, toggle, id }) => {
  return (
    <Toggle.Root
      id={id}
      pressed={isToggled}
      onPressedChange={() => toggle()}
      className={
        "relative w-8 h-5 rounded-full p-0.5 transition-colors border border-foreground/20" +
        (isToggled ? " bg-primary" : " bg-primary/20")
      }
      aria-label="Toggle"
    >
      <span
        className={`block w-3 h-3 border rounded-full shadow-md transform transition-transform bg-foreground/70
          ${isToggled ? "translate-x-3 " : "translate-x-0"}`}
      />
    </Toggle.Root>
  )
}

export default SliderToggle
