import type { Metadata } from 'next'

export async function generateMetadata({ params }: any): Promise<Metadata> {
  // Obtener evento dinámicamente
  const { data: event } = await import('@/lib/supabase/server').then(m =>
    m.createClient().then(c =>
      c.from('events')
        .select('*')
        .eq('id', params.eventId)
        .single()
    )
  )

  if (!event) {
    return {
      title: 'Evento no encontrado',
      description: 'El evento que buscas no existe',
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://boleteria.com'
  const eventUrl = `${baseUrl}/eventos/${event.slug || event.id}`
  const imageUrl = event.banner_url || `${baseUrl}/og-default.jpg`

  return {
    title: `${event.name} | Boletería Colombia`,
    description: event.description || `Compra tus boletas para ${event.name}`,
    keywords: [event.name, 'boletería', 'boletas', 'entradas', event.category?.name].filter(Boolean),

    // Open Graph
    openGraph: {
      title: event.name,
      description: event.description,
      url: eventUrl,
      type: 'website',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: event.name,
        },
      ],
      siteName: 'Boletería Colombia',
    },

    // Twitter
    twitter: {
      card: 'summary_large_image',
      title: event.name,
      description: event.description,
      images: [imageUrl],
    },

    // Metadata
    authors: [{ name: 'Boletería Colombia' }],
    creator: 'Boletería Colombia',
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    robots: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  }
}
