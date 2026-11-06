import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Alert } from "../../components/Feedback";
import { InputField } from "../../components/FormField";
import { useAuth } from "../../hooks/useAuth";
import { errorMessage, fieldError } from "../../lib/api";

export function SignupPage() {
  const { signup } = useAuth();
  const location = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const mutation = useMutation({ mutationFn: signup });

  const nameError = fieldError(mutation.error, "name");
  const emailError = fieldError(mutation.error, "email");
  const passwordError = fieldError(mutation.error, "password");
  const shownOnField = Boolean(nameError || emailError || passwordError);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate({ name, email, password });
  };

  return (
    <Card>
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Create your account</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {mutation.isError && !shownOnField && <Alert>{errorMessage(mutation.error)}</Alert>}
        <InputField
          label="Name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={nameError}
        />
        <InputField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={emailError}
        />
        <InputField
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          hint="At least 8 characters"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={passwordError}
        />
        <Button type="submit" loading={mutation.isPending} className="w-full">
          Create account
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        Already have an account?{" "}
        {/* Passing the state along keeps the page the visitor was originally trying to reach. */}
        <Link
          to="/login"
          state={location.state}
          className="font-medium text-brand-700 hover:underline"
        >
          Log in
        </Link>
      </p>
    </Card>
  );
}
