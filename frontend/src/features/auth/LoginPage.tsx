import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Alert } from "../../components/Feedback";
import { InputField } from "../../components/FormField";
import { useAuth } from "../../hooks/useAuth";
import { errorMessage, fieldError } from "../../lib/api";

export function LoginPage() {
  const { login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const mutation = useMutation({ mutationFn: login });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate({ email, password });
  };

  return (
    <Card>
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Log in</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {mutation.isError && <Alert>{errorMessage(mutation.error)}</Alert>}
        <InputField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldError(mutation.error, "email")}
        />
        <InputField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldError(mutation.error, "password")}
        />
        <Button type="submit" loading={mutation.isPending} className="w-full">
          Log in
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        New here?{" "}
        {/* Passing the state along keeps the page the visitor was originally trying to reach. */}
        <Link
          to="/signup"
          state={location.state}
          className="font-medium text-brand-700 hover:underline"
        >
          Sign up
        </Link>
      </p>
    </Card>
  );
}
