import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'privacyPolicy',
  title: 'Privacy Policy',
  type: 'document',
  // Singleton — only one privacy policy document
  __experimental_actions: ['update', 'publish'],
  fields: [
    defineField({
      name: 'lastUpdated',
      title: 'Last Updated Date',
      type: 'string',
      description: 'e.g. "June 18, 2025"',
    }),
    defineField({
      name: 'intro',
      title: 'Introduction Paragraph',
      type: 'text',
      rows: 4,
      description: 'Opening paragraph below the title',
    }),
    defineField({
      name: 'sections',
      title: 'Policy Sections',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({ name: 'heading', title: 'Section Heading', type: 'string' }),
            defineField({ name: 'body', title: 'Section Body', type: 'text', rows: 6 }),
          ],
          preview: {
            select: { title: 'heading' },
          },
        },
      ],
    }),
  ],
  preview: {
    prepare() {
      return { title: 'Privacy Policy' }
    },
  },
})
