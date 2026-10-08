import { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()

  // Obtener eventos
  const { data: events } = await supabase
    .from('events')
    .select('id, slug, updated_at, status')
    .eq('status', 'published')

  // Obtener funciones
  const { data: functions } = await supabase
    .from('event_functions')
    .select('id, event_id, starts_at, updated_at')

  const baseUrl = 'https://boleteria.com'

  // URLs estáticas
  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/eventos`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/sobre-nosotros`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/contacto`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ]

  // URLs dinámicas de eventos
  const eventUrls: MetadataRoute.Sitemap = (events || []).map((event: any) => ({
    url: `${baseUrl}/eventos/${event.slug || event.id}`,
    lastModified: new Date(event.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // URLs dinámicas de funciones
  const functionUrls: MetadataRoute.Sitemap = (functions || []).map((func: any) => ({
    url: `${baseUrl}/checkout?functionId=${func.id}`,
    lastModified: new Date(func.updated_at),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }))

  return [...staticUrls, ...eventUrls, ...functionUrls]
}
