import ContactForm from '@/components/ContactForm';

export function ContactSection() {
  return (
    <section id="contact" className="py-20 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="section-heading text-4xl sm:text-5xl mb-6">Get in Touch</h2>
          <p className="text-xl text-secondary max-w-3xl mx-auto">
            Have questions or feedback? We&apos;d love to hear from you!
          </p>
        </div>
        <div className="max-w-2xl mx-auto">
          <div className="surface-panel rounded-2xl p-8">
            <ContactForm />
          </div>
          <div className="mt-8 text-center text-secondary">
            <p>Or reach us at: <a href="mailto:hello@codemind.dev" className="text-blue-600 dark:text-blue-400 hover:underline">hello@codemind.dev</a></p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ContactSection;
