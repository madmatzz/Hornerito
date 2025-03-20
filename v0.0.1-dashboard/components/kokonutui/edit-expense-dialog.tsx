'use client';

import { useState } from "react";
import { Expense } from "@/hooks/useExpenses";
import { UpdateExpenseData } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface EditExpenseDialogProps {
  expense: Expense | null;
  open: boolean;
  onClose: () => void;
  onSave: (id: number, data: UpdateExpenseData) => Promise<void>;
}

const CATEGORIES = [
  { value: "Food & Drinks", subcategories: ["Meals", "Groceries", "Snacks", "Coffee"] },
  { value: "Transport", subcategories: ["Fuel", "Public Transport", "Taxis & Rideshares", "Parking"] },
  { value: "Shopping", subcategories: ["Clothing", "Electronics", "Home", "Gifts"] },
  { value: "Bills & Utilities", subcategories: ["Rent", "Utilities", "Phone", "Internet", "Taxes"] },
  { value: "Entertainment", subcategories: ["Movies", "Games", "Music", "Sports"] },
  { value: "Health", subcategories: ["Medical", "Pharmacy", "Fitness"] },
  { value: "Other", subcategories: ["Other"] }
];

export default function EditExpenseDialog({ expense, open, onClose, onSave }: EditExpenseDialogProps) {
  const defaultValues = expense ? {
    amount: expense.amount,
    category: expense.category,
    subcategory: expense.subcategory,
    description: expense.description,
    date: expense.date,
    frequency: expense.frequency,
  } : {
    amount: 0,
    category: '',
    subcategory: '',
    description: '',
    date: new Date().toISOString(),
    frequency: '',
  };

  const [formData, setFormData] = useState<UpdateExpenseData>({
    amount: defaultValues.amount,
    category: defaultValues.category,
    subcategory: defaultValues.subcategory,
    description: defaultValues.description,
    date: defaultValues.date,
    is_recurring: expense?.is_recurring || false,
    frequency: defaultValues.frequency,
  });

  const [loading, setLoading] = useState(false);

  // Update form data when expense changes
  useState(() => {
    if (expense) {
      setFormData({
        amount: expense.amount,
        category: expense.category,
        subcategory: expense.subcategory,
        description: expense.description,
        date: expense.date,
        is_recurring: expense.is_recurring,
        frequency: expense.frequency || null,
      });
    }
  }, [expense]);

  const handleSave = async () => {
    if (!expense) return;
    
    try {
      setLoading(true);
      await onSave(expense.id, formData);
      onClose();
    } catch (error) {
      console.error('Error saving expense:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = CATEGORIES.find(cat => cat.value === formData.category) || CATEGORIES[CATEGORIES.length - 1];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Expense</DialogTitle>
          <DialogDescription>
            Make changes to your expense here. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">
              Amount
            </Label>
            <Input
              id="amount"
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Description
            </Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category" className="text-right">
              Category
            </Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value, subcategory: CATEGORIES.find(cat => cat.value === value)?.subcategories[0] || "Other" })}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="subcategory" className="text-right">
              Subcategory
            </Label>
            <Select
              value={formData.subcategory}
              onValueChange={(value) => setFormData({ ...formData, subcategory: value })}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a subcategory" />
              </SelectTrigger>
              <SelectContent>
                {selectedCategory.subcategories.map((sub) => (
                  <SelectItem key={sub} value={sub}>
                    {sub}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="date" className="text-right">
              Date
            </Label>
            <Input
              id="date"
              type="datetime-local"
              value={new Date(formData.date).toISOString().slice(0, 16)}
              onChange={(e) => setFormData({ ...formData, date: new Date(e.target.value).toISOString() })}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="is_recurring" className="text-right">
              Recurring
            </Label>
            <div className="flex items-center space-x-2 col-span-3">
              <Switch
                id="is_recurring"
                checked={formData.is_recurring}
                onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked })}
              />
              <Label htmlFor="is_recurring">Make this a recurring expense</Label>
            </div>
          </div>
          {formData.is_recurring && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="frequency" className="text-right">
                Frequency
              </Label>
              <Select
                value={formData.frequency || "monthly"}
                onValueChange={(value) => setFormData({ ...formData, frequency: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 