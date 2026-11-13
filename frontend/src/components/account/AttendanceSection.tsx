import { useState } from 'react'
import EventGrid from '@/components/account/EventGrid'
import SectionHeading from '@/components/common/SectionHeading'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useAttendances } from '@/hooks/useUserEvents'
import type { AttendanceWhen } from '@/services/api'

const emptyMessages: Record<AttendanceWhen, string> = {
  futuras: 'Você ainda não marcou "Vou" em nenhum evento. Na página de um evento, confirme sua presença.',
  passadas: 'Nenhum evento passado com presença marcada.',
}

export default function AttendanceSection() {
  const [when, setWhen] = useState<AttendanceWhen>('futuras')
  const result = useAttendances(when)

  return (
    <section id="presencas" aria-labelledby="presencas-titulo">
      <SectionHeading
        id="presencas-titulo"
        title="Presenças"
        description="Eventos em que você marcou que vai."
        className="mb-5"
        titleClassName="text-2xl"
      >
        <ToggleGroup
          type="single"
          value={when}
          // O Radix envia '' ao clicar na opção já marcada; ignorar mantém sempre uma selecionada.
          onValueChange={(value: AttendanceWhen | '') => value && setWhen(value)}
          aria-label="Quais presenças mostrar"
          className="w-auto"
        >
          <ToggleGroupItem value="futuras" className="min-h-8 text-xs">
            Próximas
          </ToggleGroupItem>
          <ToggleGroupItem value="passadas" className="min-h-8 text-xs">
            Já fui
          </ToggleGroupItem>
        </ToggleGroup>
      </SectionHeading>

      <EventGrid {...result} emptyMessage={emptyMessages[when]} />
    </section>
  )
}
