import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Home,
  ShoppingCart,
  Car,
  Utensils,
  DollarSign,
  Wifi,
  Phone,
  Heart,
  Dumbbell,
  Tv,
  Gamepad,
  Music,
  Plane,
  GraduationCap,
  type LucideIcon
} from "lucide-react";

interface RecurringExpensesProps {
  expenses: any[];
  loading?: boolean;
  onAddExpense?: (expense: {
    icon: string;
    description: string;
    amount: number;
    start_date: string;
    end_date?: string;
    is_recurring: boolean;
  }) => void;
}

const EXPENSE_ICONS: { [key: string]: { icon: LucideIcon; label: string } } = {
  home: { icon: Home, label: "Housing" },
  shopping: { icon: ShoppingCart, label: "Shopping" },
  transport: { icon: Car, label: "Transport" },
  food: { icon: Utensils, label: "Food" },
  bills: { icon: DollarSign, label: "Bills" },
  internet: { icon: Wifi, label: "Internet" },
  phone: { icon: Phone, label: "Phone" },
  health: { icon: Heart, label: "Health" },
  fitness: { icon: Dumbbell, label: "Fitness" },
  entertainment: { icon: Tv, label: "Entertainment" },
  gaming: { icon: Gamepad, label: "Gaming" },
  music: { icon: Music, label: "Music" },
  travel: { icon: Plane, label: "Travel" },
  education: { icon: GraduationCap, label: "Education" },
};

export function RecurringExpenses({ expenses = [], loading = false, onAddExpense }: RecurringExpensesProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState<string>("bills");
  const [startDate, setStartDate] = useState<Date>();
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState<Date>();
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!startDate || !formData.description || !formData.amount) {
      return; // Add proper validation feedback later
    }

    // Validate that end date is after start date if it exists
    if (hasEndDate && endDate && endDate < startDate) {
      // Add proper validation feedback later
      return;
    }

    const newExpense = {
      icon: selectedIcon,
      description: formData.description,
      amount: parseFloat(formData.amount),
      start_date: startDate.toISOString(),
      ...(hasEndDate && endDate && { end_date: endDate.toISOString() }),
      is_recurring: true,
    };

    onAddExpense?.(newExpense);
    
    // Reset form
    setFormData({ description: "", amount: "" });
    setStartDate(undefined);
    setEndDate(undefined);
    setHasEndDate(false);
    setSelectedIcon("bills");
    setIsModalOpen(false);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="animate-pulse bg-gray-200 dark:bg-gray-700 h-6 w-48 rounded" />
          <CardDescription className="animate-pulse bg-gray-200 dark:bg-gray-700 h-4 w-32 rounded mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-700 h-12 w-full rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const recurringExpenses = expenses.filter(expense => expense.is_recurring);
  const SelectedIconComponent = EXPENSE_ICONS[selectedIcon]?.icon;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Recurring Expenses</CardTitle>
          <CardDescription>Monthly recurring payments</CardDescription>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          variant="default"
          size="sm"
        >
          Add New
        </Button>
      </CardHeader>
      <CardContent>
        {recurringExpenses.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            No recurring expenses found
          </div>
        ) : (
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-6 2xl:w-8 px-1 sm:px-2"></TableHead>
                <TableHead className="w-14 sm:w-16 md:w-20 px-1 sm:px-2 text-xs sm:text-sm">Due</TableHead>
                <TableHead className="px-1 sm:px-2 text-xs sm:text-sm">Description</TableHead>
                <TableHead className="w-16 sm:w-20 md:w-24 text-right px-1 sm:px-2 text-xs sm:text-sm">Amount</TableHead>
                <TableHead className="w-12 sm:w-14 md:w-16 px-1 sm:px-2 text-xs sm:text-sm">Freq.</TableHead>
                <TableHead className="w-14 sm:w-16 md:w-20 text-right px-1 sm:px-2 text-xs sm:text-sm">End</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recurringExpenses.map((expense) => {
                const ExpenseIcon = EXPENSE_ICONS[expense.icon || "bills"]?.icon || DollarSign;
                return (
                  <TableRow key={expense.id} className="group hover:bg-muted/50">
                    <TableCell className="py-1 sm:py-1.5 px-1 sm:px-2">
                      <ExpenseIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground group-hover:text-primary" />
                    </TableCell>
                    <TableCell className="py-1 sm:py-1.5 px-1 sm:px-2 text-xs sm:text-sm">
                      {format(new Date(expense.date || expense.last_tracked), 'dd/MM/yy')}
                    </TableCell>
                    <TableCell className="py-1 sm:py-1.5 px-1 sm:px-2">
                      <div className="flex flex-col gap-0">
                        <span className="text-sm sm:text-base leading-tight truncate font-medium" title={expense.description}>
                          {expense.description}
                        </span>
                        {expense.category && (
                          <span className="text-xs sm:text-sm leading-tight text-muted-foreground truncate" title={expense.category}>
                            {expense.category}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-1 sm:py-1.5 px-1 sm:px-2 text-right text-xs sm:text-sm font-medium">
                      {formatCurrency(expense.amount)}
                    </TableCell>
                    <TableCell className="py-1 sm:py-1.5 px-1 sm:px-2 text-xs sm:text-sm capitalize">
                      {expense.frequency || 'Monthly'}
                    </TableCell>
                    <TableCell className="py-1 sm:py-1.5 px-1 sm:px-2 text-right text-xs sm:text-sm text-muted-foreground">
                      {expense.end_date ? format(new Date(expense.end_date), 'dd/MM/yy') : '∞'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Recurring Expense</DialogTitle>
            <DialogDescription>
              Create a new recurring expense that will be tracked monthly.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="icon">Icon</Label>
              <Select value={selectedIcon} onValueChange={setSelectedIcon}>
                <SelectTrigger id="icon" className="w-full">
                  <SelectValue placeholder="Select an icon">
                    {SelectedIconComponent && (
                      <div className="flex items-center gap-2">
                        <SelectedIconComponent className="h-4 w-4" />
                        <span>{EXPENSE_ICONS[selectedIcon].label}</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EXPENSE_ICONS).map(([value, { icon: Icon, label }]) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Enter description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-full justify-start text-left font-normal ${!startDate && "text-muted-foreground"}`}
                  >
                    {startDate ? format(startDate, "dd/MM/yyyy") : "Pick a start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="hasEndDate"
                checked={hasEndDate}
                onCheckedChange={setHasEndDate}
              />
              <Label htmlFor="hasEndDate">Set an end date</Label>
            </div>

            {hasEndDate && (
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-full justify-start text-left font-normal ${!endDate && "text-muted-foreground"}`}
                    >
                      {endDate ? format(endDate, "dd/MM/yyyy") : "Pick an end date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      disabled={(date) => startDate ? date < startDate : false}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
} 