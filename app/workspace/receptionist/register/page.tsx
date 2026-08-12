import { PageHeader } from '@/components/ui';
import { RegisterForm } from './register-form';

export default function RegisterPatient() {
  return (
    <>
      <PageHeader
        title="Register patient"
        subtitle="The MRN is allocated by the database when you save, so two desks registering at once cannot collide."
      />
      <RegisterForm />
    </>
  );
}
