import { PointerSensor } from '@dnd-kit/core'

// data-no-dnd="true" が付いた要素ではドラッグを開始しない
export class SmartPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent: event }: { nativeEvent: PointerEvent }) => {
        let target = event.target as HTMLElement | null
        while (target) {
          if (target.dataset.noDnd) return false
          target = target.parentElement
        }
        return true
      },
    },
  ]
}
